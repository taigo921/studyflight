// 地図スタイルの組み立て。すべて APIキー不要の配信元を使う。
//
// - 衛星写真: Sentinel-2 cloudless (EOX IT Services) — 約10m解像度の雲なし合成画像
// - 3D 地形: Terrain Tiles (Mapzen / AWS Open Data, terrarium 形式)
// - 標準・ダーク・地名ラベル: OpenFreeMap（OpenStreetMap / OpenMapTiles）
// - 地球: 同梱の Natural Earth（オフラインでも表示できる）
//
// 配信元は環境変数で差し替えられる（商用利用時など）。外部タイルは Service Worker で事前キャッシュしない。

import type { LayerSpecification, SourceSpecification, StyleSpecification } from "maplibre-gl";
import type { MapStyleId } from "@/domain/types";
import { graticule, WORLD_LAND_URL } from "./world";

const SATELLITE_TILES = process.env.NEXT_PUBLIC_SATELLITE_TILES ?? "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
const SATELLITE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ??
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';
const SATELLITE_MAXZOOM = Number(process.env.NEXT_PUBLIC_SATELLITE_MAXZOOM ?? 14);
const TERRAIN_TILES = process.env.NEXT_PUBLIC_TERRAIN_TILES ?? "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const OFM_STYLES = process.env.NEXT_PUBLIC_VECTOR_STYLE_BASE ?? "https://tiles.openfreemap.org/styles/";

export const DEM_SOURCE_ID = "sf-dem";

/** 地図の出典（スタイルごと）。画面の「ⓘ」から常に確認できるようにする。 */
export function mapCredits(id: MapStyleId): { label: string; href: string }[] {
  const ne = { label: "Natural Earth（パブリックドメイン）", href: "https://www.naturalearthdata.com/" };
  const terrain = { label: "Terrain Tiles（Mapzen / AWS Open Data）", href: "https://registry.opendata.aws/terrain-tiles/" };
  const osm = [
    { label: "OpenFreeMap", href: "https://openfreemap.org/" },
    { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
    { label: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
  ];
  if (id === "globe") return [ne];
  if (id === "satellite")
    return [{ label: process.env.NEXT_PUBLIC_SATELLITE_CREDIT ?? "Sentinel-2 cloudless by EOX IT Services GmbH（Contains modified Copernicus Sentinel data 2024）", href: "https://s2maps.eu" }, terrain, ...osm, ne];
  return [...osm, terrain, ne];
}

export const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  satellite: "衛星写真",
  standard: "標準",
  dark: "ダーク",
  globe: "地球（オフライン可）",
};

const SKY = {
  "sky-color": "#0b1a33",
  "horizon-color": "#3c6aa8",
  "fog-color": "#0b1a33",
  "sky-horizon-blend": 0.6,
  "horizon-fog-blend": 0.5,
  "fog-ground-blend": 0.85,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 8, 0],
} as unknown as StyleSpecification["sky"];

const demSource: SourceSpecification = {
  type: "raster-dem",
  tiles: [TERRAIN_TILES],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 13,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Mapzen, AWS Open Data)',
};

/** 画像が届かないときにも陸地の形が分かるよう、同梱データを最背面に置く。 */
function fallbackLayers(): { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] } {
  return {
    sources: {
      "sf-land": { type: "geojson", data: WORLD_LAND_URL, attribution: "Natural Earth" },
      "sf-graticule": { type: "geojson", data: graticule(15) },
    },
    layers: [
      { id: "sf-ocean", type: "background", paint: { "background-color": "#0a1830" } },
      { id: "sf-graticule", type: "line", source: "sf-graticule", paint: { "line-color": "#1a2f52", "line-width": 0.6 } },
      { id: "sf-land", type: "fill", source: "sf-land", paint: { "fill-color": "#17305a", "fill-opacity": 0.95 } },
      { id: "sf-coast", type: "line", source: "sf-land", paint: { "line-color": "#3a5f95", "line-width": 0.8 } },
    ],
  };
}

const vectorCache = new Map<string, Promise<StyleSpecification | null>>();

function loadVectorStyle(name: "liberty" | "dark"): Promise<StyleSpecification | null> {
  let p = vectorCache.get(name);
  if (!p) {
    p = fetch(OFM_STYLES + name)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .catch(() => null);
    p.then((v) => v === null && vectorCache.delete(name));
    vectorCache.set(name, p);
  }
  return p;
}

/** 文字ラベルを日本語優先にする（無ければ現地名）。 */
function localize(layers: LayerSpecification[]): LayerSpecification[] {
  return layers.map((l) => {
    if (l.type !== "symbol" || !l.layout || !("text-field" in l.layout)) return l;
    return { ...l, layout: { ...l.layout, "text-field": ["coalesce", ["get", "name:ja"], ["get", "name"]] } } as LayerSpecification;
  });
}

/** 衛星写真の上に重ねる地名ラベル（OpenFreeMap の liberty スタイルから地名・水域名だけを取り出す）。 */
function labelLayersFrom(style: StyleSpecification): LayerSpecification[] {
  return localize(
    style.layers.filter(
      (l) =>
        l.type === "symbol" &&
        "source-layer" in l &&
        (l["source-layer"] === "place" || l["source-layer"] === "water_name" || l["source-layer"] === "aerodrome_label"),
    ),
  ).map((l) => {
    if (l.type !== "symbol") return l;
    return { ...l, paint: { ...l.paint, "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.4 } } as LayerSpecification;
  });
}

export interface BuiltStyle {
  style: StyleSpecification;
  /** 3D 地形を有効にできるか */
  terrain: boolean;
}

export async function buildMapStyle(id: MapStyleId, opts: { labels: boolean }): Promise<BuiltStyle> {
  const fb = fallbackLayers();
  const base = {
    version: 8 as const,
    projection: { type: "globe" },
    sky: SKY,
  } as Pick<StyleSpecification, "version" | "projection" | "sky">;

  if (id === "globe") {
    return { style: { ...base, sources: fb.sources, layers: fb.layers }, terrain: false };
  }

  if (id === "satellite") {
    const vector = opts.labels ? await loadVectorStyle("liberty") : null;
    const labels = vector ? labelLayersFrom(vector) : [];
    const vectorSources = vector && labels.length ? Object.fromEntries(Object.entries(vector.sources).filter(([k]) => labels.some((l) => "source" in l && l.source === k))) : {};
    return {
      style: {
        ...base,
        ...(vector?.glyphs && labels.length ? { glyphs: vector.glyphs } : {}),
        ...(vector?.sprite && labels.length ? { sprite: vector.sprite } : {}),
        sources: {
          ...fb.sources,
          "sf-satellite": { type: "raster", tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: SATELLITE_MAXZOOM, attribution: SATELLITE_ATTRIBUTION },
          [DEM_SOURCE_ID]: demSource,
          ...vectorSources,
        },
        layers: [...fb.layers, { id: "sf-satellite", type: "raster", source: "sf-satellite", paint: { "raster-fade-duration": 200 } }, ...labels],
      },
      terrain: true,
    };
  }

  // 標準 / ダーク: OpenFreeMap のスタイルを日本語化して使う。取得できなければ地球スタイルで代替
  const vector = await loadVectorStyle(id === "dark" ? "dark" : "liberty");
  if (!vector) return { style: { ...base, sources: fb.sources, layers: fb.layers }, terrain: false };
  const layers = localize(opts.labels ? vector.layers : vector.layers.filter((l) => l.type !== "symbol"));
  return {
    style: { ...vector, ...base, sources: { ...vector.sources, [DEM_SOURCE_ID]: demSource }, layers },
    terrain: true,
  };
}
