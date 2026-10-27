"use client";

// MapLibre GL の globe 投影による地球儀。外部タイルを使わず、同梱の陸地データだけで描画する。
// 失敗時は onFail を呼び、呼び出し側で 2D 表示に切り替える（タイマーには影響しない）。

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import type { Map as MLMap, Marker, GeoJSONSource } from "maplibre-gl";
import { flightPositionAt, haversineKm, type LngLat } from "@/domain/geo";
import { graticule, WORLD_LAND_URL } from "@/lib/world";
import { flownLines, multiLine, routeLines, zoomForDistance } from "./routeGeometry";
import { planeSvgMarkup } from "./PlaneGlyph";
import { withBase } from "@/lib/base-path";

export interface GlobeMapProps {
  origin: LngLat;
  destination: LngLat;
  originCode: string;
  destinationCode: string;
  progress: number;
  reducedMotion: boolean;
  onFail: (reason: string) => void;
}

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

function airportMarkerEl(code: string, kind: "origin" | "destination"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none";
  const color = kind === "origin" ? "#66B3FF" : "#EBC77B";
  el.innerHTML = `<span style="font:600 11px/1 var(--font-mono);letter-spacing:.08em;color:#F6F8FF;background:rgba(7,16,31,.75);border:1px solid ${color}88;border-radius:6px;padding:3px 5px">${code}</span><span style="width:8px;height:8px;border-radius:999px;background:${color};box-shadow:0 0 0 3px ${color}33"></span>`;
  return el;
}

export default function GlobeMap({ origin: originProp, destination: destProp, originCode, destinationCode, progress, reducedMotion, onFail }: GlobeMapProps) {
  // 配列の同一性ではなく値で依存させる（毎秒の再描画で地図を作り直さない）
  const [oLng, oLat] = originProp;
  const [dLng, dLat] = destProp;
  const origin = useMemo<LngLat>(() => [oLng, oLat], [oLng, oLat]);
  const destination = useMemo<LngLat>(() => [dLng, dLat], [dLng, dLat]);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const planeRef = useRef<Marker | null>(null);
  const readyRef = useRef(false);
  const interactingUntil = useRef(0);
  const latest = useRef({ progress, reducedMotion });
  const onFailRef = useRef(onFail);
  useEffect(() => {
    latest.current = { progress, reducedMotion };
    onFailRef.current = onFail;
  });

  // 初期化（ルートが変わったら作り直す）
  useEffect(() => {
    let disposed = false;
    let map: MLMap | null = null;
    let removeContextListener = () => {};
    const onContextLost = () => {
      if (!disposed) onFailRef.current("webgl context lost");
    };
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (disposed || !container.current) return;
        ml.setWorkerUrl(withBase("/maplibre/maplibre-gl-worker.mjs"));
        const start = flightPositionAt(origin, destination, latest.current.progress);
        const km = haversineKm(origin, destination);
        map = new ml.Map({
          container: container.current,
          style: STYLE_URL ?? {
            version: 8,
            projection: { type: "globe" },
            sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
            sources: {
              land: { type: "geojson", data: WORLD_LAND_URL, attribution: "Natural Earth" },
              graticule: { type: "geojson", data: graticule(15) },
            },
            layers: [
              { id: "ocean", type: "background", paint: { "background-color": "#0a1830" } },
              { id: "graticule", type: "line", source: "graticule", paint: { "line-color": "#1a2f52", "line-width": 0.6 } },
              { id: "land", type: "fill", source: "land", paint: { "fill-color": "#17305a", "fill-opacity": 0.95 } },
              { id: "coast", type: "line", source: "land", paint: { "line-color": "#3a5f95", "line-width": 0.8 } },
            ],
          },
          center: start.position,
          zoom: zoomForDistance(km),
          // 同梱データ利用時の出典はフライト画面の HUD に常時表示する。外部スタイル利用時は MapLibre の表示を使う
          attributionControl: STYLE_URL ? { compact: true } : false,
          renderWorldCopies: false,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        // 下部のタイマー・操作パネルに機体が隠れないよう、地図の中心を上にずらす
        const applyPadding = () => {
          const h = container.current?.clientHeight ?? 0;
          map?.setPadding({ top: 90, bottom: Math.round(h * 0.42), left: 0, right: 0 });
        };
        applyPadding();
        map.on("resize", applyPadding);
        map.on("error", (e) => {
          // 外部スタイル利用時のタイル取得失敗などは致命的でない。初期化前の失敗のみ 2D へ
          if (!readyRef.current) onFailRef.current(e.error?.message ?? "map error");
        });
        const canvas = map.getCanvas();
        canvas.addEventListener("webglcontextlost", onContextLost, { once: true });
        removeContextListener = () => canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.setAttribute("aria-hidden", "true");
        const markInteract = () => (interactingUntil.current = Date.now() + 10_000);
        map.on("dragstart", markInteract);
        map.on("zoomstart", (e) => {
          if ((e as { originalEvent?: Event }).originalEvent) markInteract();
        });

        map.on("load", () => {
          if (disposed || !map) return;
          map.setProjection({ type: "globe" });
          const p = latest.current.progress;
          map.addSource("route", { type: "geojson", data: multiLine(routeLines(origin, destination)) });
          map.addSource("flown", { type: "geojson", data: multiLine(flownLines(origin, destination, p)) });
          map.addLayer({ id: "route-glow", type: "line", source: "route", paint: { "line-color": "#66B3FF", "line-width": 6, "line-opacity": 0.12, "line-blur": 4 } });
          map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round" }, paint: { "line-color": "#66B3FF", "line-width": 1.6, "line-dasharray": [2, 2], "line-opacity": 0.85 } });
          map.addLayer({ id: "flown", type: "line", source: "flown", layout: { "line-cap": "round" }, paint: { "line-color": "#EBC77B", "line-width": 2.6 } });
          new ml.Marker({ element: airportMarkerEl(originCode, "origin"), anchor: "bottom" }).setLngLat(origin).addTo(map);
          new ml.Marker({ element: airportMarkerEl(destinationCode, "destination"), anchor: "bottom" }).setLngLat(destination).addTo(map);
          const el = document.createElement("div");
          el.innerHTML = planeSvgMarkup(34);
          el.setAttribute("aria-hidden", "true");
          const pos = flightPositionAt(origin, destination, p);
          planeRef.current = new ml.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map", rotation: pos.bearing }).setLngLat(pos.position).addTo(map);
          readyRef.current = true;
        });
      } catch (e) {
        onFailRef.current(e instanceof Error ? e.message : "map init failed");
      }
    })();
    return () => {
      disposed = true;
      removeContextListener();
      readyRef.current = false;
      planeRef.current = null;
      try {
        map?.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
  }, [origin, destination, originCode, destinationCode]);

  // 進捗の反映（1秒ごと程度）。カメラは機体を追従し、操作後10秒は追従を止める。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const pos = flightPositionAt(origin, destination, progress);
    (map.getSource("flown") as GeoJSONSource | undefined)?.setData(multiLine(flownLines(origin, destination, progress)));
    planeRef.current?.setLngLat(pos.position).setRotation(pos.bearing);
    if (Date.now() > interactingUntil.current && document.visibilityState === "visible") {
      if (reducedMotion) map.jumpTo({ center: pos.position });
      else map.easeTo({ center: pos.position, duration: 900, easing: (t) => t });
    }
  }, [origin, destination, progress, reducedMotion]);

  // MapLibre の CSS がコンテナを position:relative にするため、外側で絶対配置する
  return (
    <div className="absolute inset-0" role="img" aria-label={`${originCode}から${destinationCode}への航路を示す地球儀`}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
