// OpenFlights routes.dat（ODbL 1.0）から直行便の路線一覧 public/data/routes.json を生成する。
// 使い方: node scripts/build-routes.mjs raw-data/routes.dat
// 取得元: https://github.com/jpatokal/openflights/tree/master/data （2014年6月時点で更新停止）
// 注意: 予定飛行時間は含まれない（アプリ側で距離から推定し「推定」と表示する）。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const input = process.argv[2] ?? "raw-data/routes.dat";
const airports = JSON.parse(readFileSync(join("public", "data", "airports.json"), "utf8"));
const f = Object.fromEntries(airports.fields.map((k, i) => [k, i]));
// IATA → 空港 ID（同じ IATA が複数ある場合は大規模空港を優先。airports.json は大規模空港が先頭）
const byIata = new Map();
for (const r of airports.rows) if (r[f.iata] && !byIata.has(r[f.iata])) byIata.set(r[f.iata], r[f.id]);

const pairs = new Map(); // "SRC>DST" -> Set(carriers)
let skipped = 0;
for (const line of readFileSync(input, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [airline, , src, , dst, , , stops] = line.split(",");
  if (stops !== "0") continue; // 直行便のみ
  const a = byIata.get(src);
  const b = byIata.get(dst);
  if (!a || !b || a === b) {
    skipped++;
    continue;
  }
  const key = `${a}>${b}`;
  if (!pairs.has(key)) pairs.set(key, new Set());
  if (/^[A-Z0-9]{2}$/.test(airline)) pairs.get(key).add(airline);
}

const adjacency = {};
for (const [key, carriers] of pairs) {
  const [a, b] = key.split(">");
  (adjacency[a] ??= []).push([b, [...carriers].sort().slice(0, 6).join(" ")]);
}
for (const list of Object.values(adjacency)) list.sort((x, y) => x[0].localeCompare(y[0]));

const payload = {
  version: 1,
  source: "OpenFlights route database (https://openflights.org/data) — Open Database License (ODbL) 1.0",
  dataAsOf: "2014-06",
  generatedAt: new Date().toISOString(),
  routes: adjacency,
};
writeFileSync(join("public", "data", "routes.json"), JSON.stringify(payload));
console.log(`[routes] ${pairs.size} direct routes from ${Object.keys(adjacency).length} airports (skipped ${skipped} rows without matching airports)`);
