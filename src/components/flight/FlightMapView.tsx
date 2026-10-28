"use client";

// フライト中の 3D 地図。保存された時刻から算出した進捗に合わせ、毎フレーム機体とカメラを動かす。
// カメラ: follow = 機体の後方上空から追従 / overview = 航路全体 / window = 客室の窓から横を見下ろす。
// 離陸直後と着陸前は高度（ズーム）が変わり、地上に近づく。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import { flightPositionAt, haversineKm, slerp, type LngLat } from "@/domain/geo";
import type { FlightCamera, MapStyleId, RenderQuality } from "@/domain/types";
import { deviceHints, resolveRenderSettings } from "@/lib/render-quality";
import MapCanvas, { type MapLib } from "@/components/map/MapCanvas";
import { flownLines, multiLine, routeLines } from "./routeGeometry";
import { createPlaneMarker, type PlaneMarker } from "./planeMarker";
import { createPlane3D, PLANE_LAYER_ID, type Plane3D } from "./plane3d";
import { displayScale, MODEL_LENGTH_M } from "./plane3dMath";
import { withBase } from "@/lib/base-path";

const MODEL_URL = withBase("/models/studyflight-787-9.glb");
/** 画面上の機体の長さ（px） */
const PLANE_PX = { follow: 130, free: 90, overview: 46 } as const;
/** 「機体に戻る」でカメラが戻るまでの時間（ms） */
const RETURN_MS = 700;

export interface FlightMapViewProps {
  origin: LngLat;
  destination: LngLat;
  originCode: string;
  destinationCode: string;
  /** 現在の進捗（0..1）を返す。毎フレーム呼ばれる */
  getProgress: () => number;
  plannedSeconds: number;
  styleId: MapStyleId;
  labels: boolean;
  camera: FlightCamera;
  reducedMotion: boolean;
  quality: RenderQuality;
  onFail: (reason: string) => void;
  onTileTrouble?: () => void;
}

const CRUISE_ZOOM = 9.6;
const GROUND_ZOOM = 12.8;
const TRAIL_KM = 22;

/** 高度の割合（0 = 地上、1 = 巡航）。影の離れ具合に使う。 */
export function altitudeRatio(progress: number, plannedSeconds: number): number {
  return (GROUND_ZOOM - altitudeZoom(progress, plannedSeconds)) / (GROUND_ZOOM - CRUISE_ZOOM);
}

/** 離陸・着陸の前後でズーム（高度）を変える。 */
export function altitudeZoom(progress: number, plannedSeconds: number): number {
  const phase = Math.min(0.15, (8 * 60) / Math.max(60, plannedSeconds)); // 最大8分、全体の15%まで
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (progress < phase) return GROUND_ZOOM - (GROUND_ZOOM - CRUISE_ZOOM) * ease(progress / phase);
  if (progress > 1 - phase) return CRUISE_ZOOM + (GROUND_ZOOM - CRUISE_ZOOM) * ease((progress - (1 - phase)) / phase);
  return CRUISE_ZOOM;
}

function airportMarkerEl(code: string, kind: "origin" | "destination"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none";
  const color = kind === "origin" ? "#66B3FF" : "#EBC77B";
  el.innerHTML = `<span style="font:700 12px/1 var(--font-mono);letter-spacing:.08em;color:#07101F;background:${color};border-radius:8px;padding:5px 7px;box-shadow:0 2px 10px rgba(0,0,0,.45)">${code}</span><span style="width:8px;height:8px;border-radius:999px;background:${color};box-shadow:0 0 0 4px ${color}44"></span>`;
  return el;
}

function trailCoords(origin: LngLat, destination: LngLat, progress: number, totalKm: number): LngLat[] {
  const dp = Math.min(progress, TRAIL_KM / Math.max(1, totalKm));
  const pts: LngLat[] = [];
  for (let i = 0; i <= 12; i++) pts.push(slerp(origin, destination, progress - dp + (dp * i) / 12));
  return pts;
}

export default function FlightMapView(props: FlightMapViewProps) {
  const { originCode, destinationCode, camera, styleId, labels, reducedMotion, quality } = props;
  // 親は毎秒新しい配列を渡すので、座標の値が変わったときだけ作り直す（描画ループを毎秒やり直さない）
  const [oLng, oLat] = props.origin;
  const [dLng, dLat] = props.destination;
  const origin = useMemo<LngLat>(() => [oLng, oLat], [oLng, oLat]);
  const destination = useMemo<LngLat>(() => [dLng, dLat], [dLng, dLat]);
  const mapRef = useRef<MLMap | null>(null);
  const planeRef = useRef<Marker | null>(null);
  const planeArt = useRef<PlaneMarker | null>(null);
  const plane3d = useRef<Plane3D | null>(null);
  // 追尾カメラ中に指で地図を動かしたら、追尾を止めて自由に見られるようにする
  const [freeLook, setFreeLook] = useState(false);
  // カメラを切り替えたら自由視点は解除（描画中に前回の値と比べて直す）
  const [prevCamera, setPrevCamera] = useState(camera);
  if (camera !== prevCamera) {
    setPrevCamera(camera);
    setFreeLook(false);
  }
  const freeRef = useRef(false);
  const resumeAt = useRef(0);
  useEffect(() => {
    freeRef.current = freeLook;
  }, [freeLook]);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const totalKm = useMemo(() => haversineKm(origin, destination), [origin, destination]);
  const route = useMemo(() => multiLine(routeLines(origin, destination)), [origin, destination]);

  const addOverlay = useCallback(
    (map: MLMap) => {
      const p = latest.current.getProgress();
      const empty = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
      if (!map.getSource("sf-route")) map.addSource("sf-route", { type: "geojson", data: route });
      if (!map.getSource("sf-flown")) map.addSource("sf-flown", { type: "geojson", data: multiLine(flownLines(origin, destination, p)) });
      if (!map.getSource("sf-trail")) map.addSource("sf-trail", { type: "geojson", data: empty, lineMetrics: true });
      const add = (layer: Parameters<MLMap["addLayer"]>[0]) => !map.getLayer(layer.id) && map.addLayer(layer);
      add({ id: "sf-route", type: "line", source: "sf-route", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 1.6, "line-opacity": 0.55, "line-dasharray": [2, 2] } });
      add({ id: "sf-flown", type: "line", source: "sf-flown", layout: { "line-cap": "round" }, paint: { "line-color": "#EBC77B", "line-width": 2.4, "line-opacity": 0.9 } });
      add({
        id: "sf-trail",
        type: "line",
        source: "sf-trail",
        layout: { "line-cap": "round" },
        paint: {
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 12, 9],
          "line-blur": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 12, 5],
          "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "rgba(255,255,255,0)", 0.75, "rgba(255,255,255,0.55)", 1, "rgba(255,255,255,0.9)"],
        },
      });
      // スタイルを切り替えるとカスタムレイヤーも消えるので、読み込みのたびに戻す
      if (plane3d.current && !map.getLayer(PLANE_LAYER_ID)) map.addLayer(plane3d.current.layer);
    },
    [route, origin, destination],
  );

  // 3D 機体（省電力では使わない）。読み込めなければ 2D の機体のまま
  useEffect(() => {
    if (!resolveRenderSettings(quality, deviceHints()).model3d) return;
    let disposed = false;
    let created: Plane3D | null = null;
    createPlane3D(MODEL_URL)
      .then((p) => {
        created = p;
        if (disposed) return p.dispose();
        plane3d.current = p;
        const map = mapRef.current;
        // タイルの読み込み中でもスタイルさえあれば追加できる（未準備なら addOverlay が後で追加する）
        try {
          if (map && !map.getLayer(PLANE_LAYER_ID)) map.addLayer(p.layer);
        } catch {
          /* スタイル読み込み後に addOverlay で追加 */
        }
        planeRef.current?.getElement().style.setProperty("visibility", "hidden");
      })
      .catch(() => {
        /* 2D の機体で続ける */
      });
    return () => {
      disposed = true;
      created?.dispose();
      plane3d.current = null;
      planeRef.current?.getElement().style.setProperty("visibility", "visible");
    };
  }, [quality]);

  const onReady = useCallback(
    (map: MLMap, ml: MapLib) => {
      mapRef.current = map;
      // 地形の高さにカメラの中心を毎フレーム合わせると、山の上で画面が上下に揺れる。高さはこちらで滑らかにして渡す
      map.setCenterClampedToGround(false);
      applyGestures(map, latest.current.camera);
      // 追尾中は毎フレームのカメラ移動が指の操作を打ち消すので、触れた瞬間に追尾をやめる
      const startFree = () => {
        if (latest.current.camera !== "follow" || freeRef.current) return;
        freeRef.current = true;
        setFreeLook(true);
      };
      const box = map.getCanvasContainer();
      for (const type of ["pointerdown", "touchstart", "wheel"] as const) box.addEventListener(type, startFree, { passive: true, capture: true });
      new ml.Marker({ element: airportMarkerEl(originCode, "origin"), anchor: "bottom" }).setLngLat(origin).addTo(map);
      new ml.Marker({ element: airportMarkerEl(destinationCode, "destination"), anchor: "bottom" }).setLngLat(destination).addTo(map);
      const cur = latest.current;
      const art = createPlaneMarker(cur.reducedMotion, cur.camera === "overview" ? 44 : 100);
      planeArt.current = art;
      const p = cur.getProgress();
      const pos = flightPositionAt(origin, destination, p);
      art.update(altitudeRatio(p, cur.plannedSeconds), pos.bearing);
      // 地図の面に沿って置く（カメラを傾けると機体も奥行きに沿って見える）
      planeRef.current = new ml.Marker({ element: art.element, rotationAlignment: "map", pitchAlignment: "map", rotation: pos.bearing, subpixelPositioning: true }).setLngLat(pos.position).addTo(map);
      // 3D 機体が先に読み込まれていれば 2D の機体は隠す
      if (plane3d.current) art.element.style.visibility = "hidden";
    },
    [origin, destination, originCode, destinationCode],
  );

  // カメラモードの切り替え時の初期配置と操作可否
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyGestures(map, camera);
    planeRef.current?.getElement().style.setProperty("display", camera === "window" ? "none" : "block");
    planeArt.current?.setSize(camera === "overview" ? 44 : 100);
    if (camera === "overview") {
      const coords = routeLines(origin, destination).flat();
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const h = map.getContainer().clientHeight;
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: Math.round(h * 0.18), bottom: Math.round(h * 0.4), left: 80, right: 90 }, pitch: 0, bearing: 0, duration: reducedMotion ? 0 : 1200, maxZoom: 9 },
      );
    }
  }, [camera, origin, destination, reducedMotion]);

  // 毎フレームの更新（非表示中は停止）
  useEffect(() => {
    let raf = 0;
    let lastFrame = 0;
    let lastData = 0;
    let lastProgress = -1;
    let groundElevation: number | null = null;
    let noseUp = 0;
    // 離陸・着陸前後は低高度（大きな縮尺）で地面が速く流れるため、カメラは滑らかに毎フレーム近く更新する。
    // 標準は約30fps、省電力は0.25秒ごと。航跡の線の更新は0.5秒ごとに間引く
    const interval = reducedMotion ? 1000 : resolveRenderSettings(quality, deviceHints()).frameIntervalMs;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const map = mapRef.current;
      if (!map || document.visibilityState !== "visible" || t - lastFrame < interval - 4) return;
      lastFrame = t;
      const cur = latest.current;
      const p = cur.getProgress();
      const pos = flightPositionAt(origin, destination, p);
      if (map.isStyleLoaded() && (t - lastData > 500 || Math.abs(p - lastProgress) > 0.01)) {
        lastData = t;
        lastProgress = p;
        (map.getSource("sf-flown") as GeoJSONSource | undefined)?.setData(multiLine(flownLines(origin, destination, p)));
        (map.getSource("sf-trail") as GeoJSONSource | undefined)?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trailCoords(origin, destination, p, totalKm) } });
      }
      const h = map.getContainer().clientHeight;
      // 地面の高さ（地形あり）をゆっくり追いかける
      const target = map.terrain ? (map.queryTerrainElevation(pos.position) ?? 0) : 0;
      groundElevation = groundElevation === null ? target : groundElevation + (target - groundElevation) * 0.06;
      const ground = groundElevation;
      const alt = altitudeRatio(p, cur.plannedSeconds);
      // 3D 機体: 画面上でほぼ一定の大きさに見えるよう拡大し、高さも同じ比率で誇張する
      const model = plane3d.current;
      const following = cur.camera === "follow" && !freeRef.current && t >= resumeAt.current;
      const zoom = following || cur.camera === "window" ? altitudeZoom(p, cur.plannedSeconds) : map.getZoom();
      const scale = displayScale(pos.position[1], zoom, cur.camera === "overview" ? PLANE_PX.overview : cur.camera === "follow" && !following ? PLANE_PX.free : PLANE_PX.follow);
      // 地図の中心は地面に置くので、機体は少しだけ浮かせ、高度感は影の離れ具合で出す
      // （カメラ中心の標高は地形なしの地図では描画に反映されないため、機体の高さには使わない）
      const planeLength = MODEL_LENGTH_M * scale;
      const altitude = model ? planeLength * (0.08 + alt * 0.25) : 0;
      const shadowDistance = planeLength * (0.06 + alt * 0.45);
      // 上昇中は機首上げ、降下中はわずかに機首下げ（急に変わらないよう滑らかに）
      const slope = altitudeRatio(Math.min(1, p + 0.002), cur.plannedSeconds) - altitudeRatio(Math.max(0, p - 0.002), cur.plannedSeconds);
      noseUp += ((slope > 1e-6 ? 8 : slope < -1e-6 ? -3 : 0) - noseUp) * 0.05;
      const elevation = ground;
      if (following) {
        map.jumpTo({ center: pos.position, elevation, zoom, bearing: pos.bearing, pitch: 62, padding: { top: 0, bottom: Math.round(h * 0.3), left: 0, right: 0 } });
      } else if (cur.camera === "window") {
        map.jumpTo({ center: pos.position, elevation, zoom: altitudeZoom(p, cur.plannedSeconds) + 1.4, bearing: (pos.bearing + 90) % 360, pitch: 74, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
      }
      model?.setFrame({
        lng: pos.position[0],
        lat: pos.position[1],
        bearing: pos.bearing,
        pitch: noseUp,
        bank: 0,
        altitude,
        shadowDistance,
        ground,
        scale,
        visible: cur.camera !== "window",
      });
      // カメラを動かした後に機体を置く（小数ピクセルのまま。整数への丸めと交互になると震えて見える）
      planeRef.current?.setLngLat(pos.position).setRotation(pos.bearing);
      planeArt.current?.update(alt, pos.bearing);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [origin, destination, totalKm, reducedMotion, quality]);

  // 「機体に戻る」: 追尾の位置へ滑らかに戻してから、毎フレームの追尾を再開する
  const backToPlane = () => {
    const map = mapRef.current;
    const cur = latest.current;
    freeRef.current = false;
    setFreeLook(false);
    if (!map) return;
    const p = cur.getProgress();
    const pos = flightPositionAt(origin, destination, p);
    const h = map.getContainer().clientHeight;
    resumeAt.current = performance.now() + (reducedMotion ? 0 : RETURN_MS);
    map.easeTo({
      center: pos.position,
      zoom: altitudeZoom(p, cur.plannedSeconds),
      bearing: pos.bearing,
      pitch: 62,
      padding: { top: 0, bottom: Math.round(h * 0.3), left: 0, right: 0 },
      duration: reducedMotion ? 0 : RETURN_MS,
    });
  };

  const start = flightPositionAt(origin, destination, props.getProgress());
  return (
    <>
    {freeLook && camera === "follow" && (
      <button
        type="button"
        onClick={backToPlane}
        className="absolute top-[calc(var(--safe-top)+5.5rem)] left-1/2 z-20 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-gold/50 bg-night/80 px-5 text-sm font-semibold text-gold shadow-lg backdrop-blur-md"
      >
        <span aria-hidden>✈︎</span> 機体に戻る
      </button>
    )}
    <MapCanvas
      styleId={styleId}
      labels={labels}
      terrain={styleId !== "globe"}
      quality={quality}
      center={start.position}
      zoom={camera === "overview" ? 4 : altitudeZoom(props.getProgress(), props.plannedSeconds)}
      ariaLabel={`${originCode}から${destinationCode}へ飛行中の地図`}
      onReady={onReady}
      onStyleLoaded={addOverlay}
      onFail={props.onFail}
      onTileTrouble={props.onTileTrouble}
    />
    </>
  );
}

/** 地図の指操作。追尾・航路全体では移動・拡大・回転・傾きを許し、機窓では固定する。 */
function applyGestures(map: MLMap, camera: FlightCamera) {
  const on = camera !== "window";
  for (const h of [map.dragPan, map.scrollZoom, map.doubleClickZoom, map.touchZoomRotate, map.touchPitch, map.dragRotate, map.boxZoom, map.keyboard]) {
    if (on) h.enable();
    else h.disable();
  }
  if (on) map.touchZoomRotate.enableRotation();
}
