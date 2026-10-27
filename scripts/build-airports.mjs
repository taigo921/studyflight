// OurAirports (Public Domain) の airports.csv を正規化し public/data/airports.json を生成する。
// 使い方: node scripts/build-airports.mjs <airports.csv>
// 取得元: https://ourairports.com/data/ (GitHub ミラー: davidmegginson/ourairports-data)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const input = process.argv[2] ?? "raw-data/airports.csv";
const jaNames = JSON.parse(readFileSync(join("scripts", "ja-airport-names.json"), "utf8"));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const [header, ...rows] = parseCsv(readFileSync(input, "utf8"));
const col = Object.fromEntries(header.map((h, i) => [h, i]));
const TYPES = { large_airport: "L", medium_airport: "M" };
const CJK = /[぀-ヿ㐀-鿿]/;
const MILITARY = /\b(Air Base|Airbase|AFB|Air Force|Naval Air|Naval Station|Army Air|JMSDF|JASDF|Military|Marine Corps)\b/i;

const out = [];
for (const r of rows) {
  const type = TYPES[r[col.type]];
  if (!type) continue;
  const lat = Number(r[col.latitude_deg]);
  const lng = Number(r[col.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const ident = r[col.ident];
  const iata = r[col.iata_code] || "";
  const icao = r[col.icao_code] || r[col.gps_code] || "";
  if (!ident || (!iata && !icao)) continue;
  // 定期便のない軍用基地は旅の行き先にならないので除外（小牧のような共用空港は定期便ありとして残る）
  if (MILITARY.test(r[col.name]) && r[col.scheduled_service] !== "yes") continue;
  const keywordsJa = (r[col.keywords] || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CJK.test(s));
  const nameJa = jaNames[ident] ?? "";
  // [id, name, municipality, country, iata, icao, lat, lng, type, nameJa, keywords]
  out.push([
    ident,
    r[col.name],
    r[col.municipality] || "",
    r[col.iso_country],
    iata,
    icao,
    Math.round(lat * 1e4) / 1e4,
    Math.round(lng * 1e4) / 1e4,
    type,
    nameJa,
    keywordsJa.join(" "),
  ]);
}
out.sort((a, b) => (a[8] === b[8] ? a[0].localeCompare(b[0]) : a[8] === "L" ? -1 : 1));

const payload = {
  version: 1,
  source: "OurAirports (https://ourairports.com/data/) — Public Domain",
  generatedAt: new Date().toISOString(),
  fields: ["id", "name", "municipality", "countryCode", "iata", "icao", "lat", "lng", "type", "nameJa", "keywords"],
  rows: out,
};
writeFileSync(join("public", "data", "airports.json"), JSON.stringify(payload));
console.log(`[airports] ${out.length} airports written to public/data/airports.json`);
