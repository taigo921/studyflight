// Natural Earth 1:110m land (Public Domain) を軽量化し public/data/world-land.json を生成する。
// 使い方: node scripts/build-world.mjs <ne_110m_land.geojson>
// 取得元: https://www.naturalearthdata.com/ (GitHub: nvkelso/natural-earth-vector)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const input = process.argv[2] ?? "raw-data/ne_110m_land.geojson";
const src = JSON.parse(readFileSync(input, "utf8"));
const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));
const features = src.features.map((f) => ({
  type: "Feature",
  properties: {},
  geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
}));
const out = { type: "FeatureCollection", features };
writeFileSync(join("public", "data", "world-land.json"), JSON.stringify(out));
console.log(`[world] ${features.length} land polygons written to public/data/world-land.json`);
