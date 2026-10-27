// 同梱の Natural Earth 陸地データ（Public Domain）。地球儀と 2D 地図で共有する。
import type { LngLat } from "@/domain/geo";
import { withBase } from "@/lib/base-path";

export const WORLD_LAND_URL = withBase("/data/world-land.json");

export interface LandCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: LngLat[][] | LngLat[][][] } }[];
}

let pending: Promise<LandCollection | null> | null = null;

export function loadWorldLand(): Promise<LandCollection | null> {
  if (!pending) {
    pending = fetch(WORLD_LAND_URL)
      .then((r) => (r.ok ? (r.json() as Promise<LandCollection>) : null))
      .catch(() => null);
  }
  return pending;
}

export function graticule(step = 30): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (let lng = -180; lng <= 180; lng += step) {
    const coords: [number, number][] = [];
    for (let lat = -85; lat <= 85; lat += 5) coords.push([lng, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  for (let lat = -60; lat <= 60; lat += step) {
    const coords: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 5) coords.push([lng, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  return { type: "FeatureCollection", features };
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
