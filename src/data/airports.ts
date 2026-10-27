// 空港データの読み込み。初回は同梱 JSON を IndexedDB の airports テーブルへ展開し、
// 以降は DB から読む。どちらも失敗した場合は CORE_AIRPORTS で動作を継続する。

import { z } from "zod";
import type { Airport } from "@/domain/types";
import { CORE_AIRPORTS } from "./core-airports";
import { getDb } from "./db";
import { withBase } from "@/lib/base-path";

const AIRPORTS_URL = withBase("/data/airports.json");
const META_KEY = "airportsDataset";

const DatasetSchema = z.object({
  version: z.number(),
  source: z.string(),
  generatedAt: z.string(),
  rows: z.array(z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number(), z.number(), z.string(), z.string(), z.string()])),
});

export function parseAirportDataset(json: unknown): { airports: Airport[]; generatedAt: string; source: string } {
  const data = DatasetSchema.parse(json);
  const airports: Airport[] = data.rows.map(([id, name, municipality, countryCode, iata, icao, lat, lng, type, nameJa, keywords]) => ({
    id,
    name,
    municipality: municipality || undefined,
    countryCode,
    iata: iata || undefined,
    icao: icao || undefined,
    lat,
    lng,
    type: type === "L" ? "large_airport" : type === "M" ? "medium_airport" : "small_airport",
    nameJa: nameJa || undefined,
    keywords: keywords || undefined,
  }));
  return { airports, generatedAt: data.generatedAt, source: data.source };
}

export interface AirportStore {
  airports: Airport[];
  byId: Map<string, Airport>;
  source: "database" | "bundle" | "fallback";
}

function buildStore(airports: Airport[], source: AirportStore["source"]): AirportStore {
  const byId = new Map<string, Airport>();
  for (const a of CORE_AIRPORTS) byId.set(a.id, a);
  for (const a of airports) byId.set(a.id, { ...byId.get(a.id), ...a });
  return { airports: [...byId.values()], byId, source };
}

let pending: Promise<AirportStore> | null = null;

async function load(): Promise<AirportStore> {
  const db = getDb();
  try {
    const meta = await db.appMetadata.get(META_KEY);
    const count = await db.airports.count();
    if (meta && count > 100) {
      // 新しいデータセットが配信されていればバックグラウンドで更新する
      void refreshIfNewer((meta.value as { generatedAt?: string })?.generatedAt);
      return buildStore(await db.airports.toArray(), "database");
    }
  } catch {
    // IndexedDB が使えない環境でも続行
  }
  try {
    const res = await fetch(AIRPORTS_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { airports, generatedAt, source } = parseAirportDataset(await res.json());
    try {
      await db.transaction("rw", db.airports, db.appMetadata, async () => {
        await db.airports.clear();
        await db.airports.bulkPut(airports);
        await db.appMetadata.put({ key: META_KEY, value: { generatedAt, source, count: airports.length } });
      });
    } catch {
      // 保存に失敗してもメモリ上のデータで続行
    }
    return buildStore(airports, "bundle");
  } catch {
    return buildStore([], "fallback");
  }
}

async function refreshIfNewer(current?: string): Promise<void> {
  try {
    const res = await fetch(AIRPORTS_URL, { cache: "no-cache" });
    if (!res.ok) return;
    const { airports, generatedAt, source } = parseAirportDataset(await res.json());
    if (current && generatedAt <= current) return;
    const db = getDb();
    await db.transaction("rw", db.airports, db.appMetadata, async () => {
      await db.airports.clear();
      await db.airports.bulkPut(airports);
      await db.appMetadata.put({ key: META_KEY, value: { generatedAt, source, count: airports.length } });
    });
    pending = null;
  } catch {
    // オフライン等は無視
  }
}

export function loadAirports(): Promise<AirportStore> {
  if (!pending) pending = load();
  return pending;
}

export function resetAirportCacheForTesting(): void {
  pending = null;
}
