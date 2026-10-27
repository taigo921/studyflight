// 空港の検索（IATA / ICAO / 英語名 / 日本語名 / 都市名）。

import type { Airport } from "./types";

export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function score(a: Airport, q: string): number {
  const iata = a.iata?.toLowerCase() ?? "";
  const icao = a.icao?.toLowerCase() ?? "";
  const name = a.name.toLowerCase();
  const ja = a.nameJa ?? "";
  const city = a.municipality?.toLowerCase() ?? "";
  const kw = a.keywords?.toLowerCase() ?? "";
  let s = 0;
  if (iata && iata === q) s = 100;
  else if (icao === q || a.id.toLowerCase() === q) s = 90;
  else if (iata && q.length <= 3 && iata.startsWith(q)) s = 70;
  else if (ja && ja.includes(q)) s = 65;
  else if (city.startsWith(q)) s = 55;
  else if (name.startsWith(q)) s = 50;
  else if (name.includes(q) || city.includes(q)) s = 40;
  else if (kw.includes(q)) s = 38;
  else if (icao.startsWith(q)) s = 30;
  if (s === 0) return 0;
  if (a.type === "large_airport") s += 5;
  if (a.iata) s += 2;
  return s;
}

export function searchAirports(airports: readonly Airport[], query: string, limit = 20): Airport[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const scored: { a: Airport; s: number }[] = [];
  for (const a of airports) {
    const s = score(a, q);
    if (s > 0) scored.push({ a, s });
  }
  scored.sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name));
  return scored.slice(0, limit).map((x) => x.a);
}

export function airportDisplayName(a: Pick<Airport, "name" | "nameJa">): string {
  return a.nameJa || a.name;
}

export function airportCodeOf(a: Pick<Airport, "iata" | "icao" | "id">): string {
  return a.iata || a.icao || a.id;
}
