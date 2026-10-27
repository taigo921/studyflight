"use client";

// フライト中の 3D 地図。保存された時刻から算出した進捗に合わせ、毎フレーム機体とカメラを動かす。
// カメラ: follow = 機体の後方上空から追従 / overview = 航路全体 / window = 客室の窓から横を見下ろす。
// 離陸直後と着陸前は高度（ズーム）が変わり、地上に近づく。

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import { flightPositionAt, haversineKm, slerp, type LngLat } from "@/domain/geo";
import type { FlightCamera, MapStyleId } from "@/domain/types";
import MapCanvas, { type MapLib } from "@/components/map/MapCanvas";
import { flownLines, multiLine, routeLines } from "./routeGeometry";
import { planeSvgMarkup } from "./PlaneGlyph";

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
  onFail: (reason: string) => void;
  onTileTrouble?: () => void;
}

const CRUISE_ZOOM = 9.6;
const GROUND_ZOOM = 12.8;
const TRAIL_KM = 22;

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
  const { origin, destination, originCode, destinationCode, camera, styleId, labels, reducedMotion } = props;
  const mapRef = useRef<MLMap | null>(null);
  const planeRef = useRef<Marker | null>(null);
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
    },
    [route, origin, destination],
  );

  const onReady = useCallback(
    (map: MLMap, ml: MapLib) => {
      mapRef.current = map;
      new ml.Marker({ element: airportMarkerEl(originCode, "origin"), anchor: "bottom" }).setLngLat(origin).addTo(map);
      new ml.Marker({ element: airportMarkerEl(destinationCode, "destination"), anchor: "bottom" }).setLngLat(destination).addTo(map);
      const el = document.createElement("div");
      el.innerHTML = planeSvgMarkup(44);
      el.setAttribute("aria-hidden", "true");
      const pos = flightPositionAt(origin, destination, latest.current.getProgress());
      planeRef.current = new ml.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "viewport", rotation: pos.bearing }).setLngLat(pos.position).addTo(map);
    },
    [origin, destination, originCode, destinationCode],
  );

  // カメラモードの切り替え時の初期配置と操作可否
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const free = camera === "overview";
    for (const h of [map.dragPan, map.scrollZoom, map.doubleClickZoom, map.touchZoomRotate, map.boxZoom, map.keyboard]) {
      if (free) h.enable();
      else h.disable();
    }
    planeRef.current?.getElement().style.setProperty("display", camera === "window" ? "none" : "block");
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
    // 巡航高度の縮尺では機体は画面上で毎秒数ピクセルしか動かないため、カメラ更新は0.5秒ごとで十分。
    // 再描画を減らしてバッテリー消費と発熱を抑える
    const interval = reducedMotion ? 1000 : 500;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const map = mapRef.current;
      if (!map || document.visibilityState !== "visible" || t - lastFrame < interval) return;
      lastFrame = t;
      const cur = latest.current;
      const p = cur.getProgress();
      const pos = flightPositionAt(origin, destination, p);
      planeRef.current?.setLngLat(pos.position).setRotation(pos.bearing);
      if (map.isStyleLoaded() && (t - lastData > 500 || Math.abs(p - lastProgress) > 0.01)) {
        lastData = t;
        lastProgress = p;
        (map.getSource("sf-flown") as GeoJSONSource | undefined)?.setData(multiLine(flownLines(origin, destination, p)));
        (map.getSource("sf-trail") as GeoJSONSource | undefined)?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trailCoords(origin, destination, p, totalKm) } });
      }
      const h = map.getContainer().clientHeight;
      if (cur.camera === "follow") {
        map.jumpTo({ center: pos.position, zoom: altitudeZoom(p, cur.plannedSeconds), bearing: pos.bearing, pitch: 58, padding: { top: Math.round(h * 0.1), bottom: 0, left: 0, right: 0 } });
      } else if (cur.camera === "window") {
        map.jumpTo({ center: pos.position, zoom: altitudeZoom(p, cur.plannedSeconds) + 1.4, bearing: (pos.bearing + 90) % 360, pitch: 74, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [origin, destination, totalKm, reducedMotion]);

  const start = flightPositionAt(origin, destination, props.getProgress());
  return (
    <MapCanvas
      styleId={styleId}
      labels={labels}
      terrain={styleId !== "globe"}
      center={start.position}
      zoom={camera === "overview" ? 4 : altitudeZoom(props.getProgress(), props.plannedSeconds)}
      ariaLabel={`${originCode}から${destinationCode}へ飛行中の地図`}
      onReady={onReady}
      onStyleLoaded={addOverlay}
      onFail={props.onFail}
      onTileTrouble={props.onTileTrouble}
    />
  );
}
