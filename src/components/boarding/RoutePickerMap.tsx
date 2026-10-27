"use client";

// 行き先選びの地図。現在地・到達範囲の円・候補空港・選択中の航路を表示する。
import { useCallback, useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import MapCanvas, { type MapLib } from "@/components/map/MapCanvas";
import { airportCodeOf } from "@/domain/airport-search";
import { circlePolygon, type LngLat } from "@/domain/geo";
import type { Candidate } from "@/domain/route-planner";
import type { Airport, MapStyleId } from "@/domain/types";
import { multiLine, routeLines } from "@/components/flight/routeGeometry";

export interface RoutePickerMapProps {
  origin: Airport;
  reachKm: number;
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (a: Airport) => void;
  styleId: MapStyleId;
  labels: boolean;
  /** 地図の下側を覆うパネルの高さ（px） */
  bottomInset: number;
}

const pos = (a: Airport): LngLat => [a.lng, a.lat];

/** 候補マーカーの見た目（選択中は白地に金の縁）。 */
function paintMarker(el: HTMLElement, marker: Marker, on: boolean) {
  el.style.background = on ? "#ffffff" : "rgba(7,16,31,.78)";
  el.style.color = on ? "#07101F" : "#F6F8FF";
  el.style.border = on ? "2px solid #EBC77B" : "1px solid rgba(235,199,123,.55)";
  el.style.transform = on ? "scale(1.18)" : "scale(1)";
  marker.getElement().style.zIndex = on ? "3" : "1";
}

function originEl(code: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center";
  el.innerHTML = `<span style="position:absolute;width:56px;height:56px;border-radius:999px;background:rgba(235,199,123,.18);animation:pulse-soft 2.4s infinite"></span><span style="position:relative;font:800 12px/1 var(--font-mono);letter-spacing:.08em;color:#07101F;background:#EBC77B;border-radius:9px;padding:6px 8px;box-shadow:0 2px 12px rgba(0,0,0,.5)">${code}</span>`;
  return el;
}

export default function RoutePickerMap({ origin, reachKm, candidates, selectedId, onSelect, styleId, labels, bottomInset }: RoutePickerMapProps) {
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<MapLib | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const originMarker = useRef<Marker | null>(null);
  const latest = useRef({ origin, reachKm, selectedId, candidates, onSelect, bottomInset });
  useEffect(() => {
    latest.current = { origin, reachKm, selectedId, candidates, onSelect, bottomInset };
  });

  const ringData = useCallback((): GeoJSON.Feature => {
    const { origin: o, reachKm: km } = latest.current;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: km > 0 ? circlePolygon(pos(o), Math.max(20, km)) : [] } };
  }, []);
  const routeData = useCallback((): GeoJSON.Feature => {
    const { origin: o, selectedId: sel, candidates: cs } = latest.current;
    const dest = cs.find((c) => c.airport.id === sel)?.airport;
    return dest ? multiLine(routeLines(pos(o), pos(dest))) : { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [] } };
  }, []);

  const fit = useCallback((animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const { origin: o, reachKm: km, selectedId: sel, candidates: cs, bottomInset: inset } = latest.current;
    const dest = cs.find((c) => c.airport.id === sel)?.airport;
    const pts = dest ? [pos(o), pos(dest)] : circlePolygon(pos(o), Math.max(20, km) * 1.08, 24);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    try {
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: 110, bottom: inset + 24, left: 36, right: 36 }, duration: animate ? 900 : 0, maxZoom: 9, pitch: 0, bearing: 0 },
      );
    } catch {
      /* 範囲が不正な場合は無視 */
    }
  }, []);

  // 候補マーカーの同期（地図の準備完了時と候補の変更時）
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml) return;
    const { candidates: cs, selectedId: sel } = latest.current;
    const keep = new Set(cs.map((c) => c.airport.id));
    for (const [id, m] of markers.current) {
      if (!keep.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    }
    for (const c of cs) {
      if (markers.current.has(c.airport.id)) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = airportCodeOf(c.airport);
      el.setAttribute("aria-label", `${airportCodeOf(c.airport)} ${c.airport.nameJa ?? c.airport.name}`);
      el.style.cssText = "font:700 11px/1 var(--font-mono);letter-spacing:.06em;border-radius:8px;padding:6px 7px;cursor:pointer;transition:transform .15s";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        latest.current.onSelect(c.airport);
      });
      markers.current.set(c.airport.id, { marker: new ml.Marker({ element: el }).setLngLat(pos(c.airport)).addTo(map), el });
    }
    for (const [id, { el, marker }] of markers.current) paintMarker(el, marker, id === sel);
  }, []);
  useEffect(() => syncMarkers(), [candidates, syncMarkers]);

  const onReady = useCallback(
    (map: MLMap, ml: MapLib) => {
      mapRef.current = map;
      mlRef.current = ml;
      originMarker.current = new ml.Marker({ element: originEl(airportCodeOf(latest.current.origin)) }).setLngLat(pos(latest.current.origin)).addTo(map);
      syncMarkers();
      map.once("load", () => fit(false));
    },
    [fit, syncMarkers],
  );

  const onStyleLoaded = useCallback(
    (map: MLMap) => {
      if (!map.getSource("sf-reach")) map.addSource("sf-reach", { type: "geojson", data: ringData() });
      if (!map.getSource("sf-pick-route")) map.addSource("sf-pick-route", { type: "geojson", data: routeData() });
      if (!map.getLayer("sf-reach")) map.addLayer({ id: "sf-reach", type: "line", source: "sf-reach", paint: { "line-color": "#EBC77B", "line-width": 1.5, "line-opacity": 0.75, "line-dasharray": [3, 3] } });
      if (!map.getLayer("sf-pick-route"))
        map.addLayer({ id: "sf-pick-route", type: "line", source: "sf-pick-route", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 3, "line-opacity": 0.95 } });
    },
    [ringData, routeData],
  );

  // 出発地・到達範囲の変更
  useEffect(() => {
    const map = mapRef.current;
    originMarker.current?.setLngLat(pos(origin));
    (map?.getSource("sf-reach") as GeoJSONSource | undefined)?.setData(ringData());
    fit(true);
  }, [origin, reachKm, fit, ringData]);


  // 選択状態の見た目と航路
  useEffect(() => {
    for (const [id, { el, marker }] of markers.current) paintMarker(el, marker, id === selectedId);
    (mapRef.current?.getSource("sf-pick-route") as GeoJSONSource | undefined)?.setData(routeData());
    if (selectedId) fit(true);
  }, [selectedId, candidates, fit, routeData]);

  return (
    <MapCanvas
      styleId={styleId}
      labels={labels}
      terrain={false}
      center={pos(origin)}
      zoom={5}
      ariaLabel={`現在地 ${airportCodeOf(origin)} からの行き先候補の地図`}
      onReady={onReady}
      onStyleLoaded={onStyleLoaded}
    />
  );
}
