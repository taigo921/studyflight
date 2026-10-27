// 旅の行き先候補・現在地・ダイバート先の計算（純粋関数）。
//
// 学習時間を「その時間で飛べる距離」に換算する。速度はジェット機の巡航速度の目安 800km/h。
// 例: 25分 ≈ 333km（中部→羽田）、60分 ≈ 800km（羽田→新千歳）、90分 ≈ 1,200km（中部→那覇）。

import { haversineKm, type LngLat } from "./geo";
import type { Airport, FlightSession } from "./types";

export const CRUISE_KMH = 800;
/** 早期着陸でもこの進捗以上なら目的地に到着したものとみなす */
export const ARRIVE_IF_PROGRESS_AT_LEAST = 0.9;

export function reachableKm(minutes: number): number {
  return (CRUISE_KMH * minutes) / 60;
}

export function flightMinutesFor(km: number): number {
  return (km / CRUISE_KMH) * 60;
}

const pos = (a: Pick<Airport, "lng" | "lat">): LngLat => [a.lng, a.lat];

/** 旅の目的地として扱う空港（旅客便の就航がありそうな、IATA コードを持つ空港）。 */
export function isDestinationAirport(a: Airport): boolean {
  return !!a.iata && (a.type === "large_airport" || a.type === "medium_airport");
}

export interface Candidate {
  airport: Airport;
  distanceKm: number;
  /** 800km/h で飛んだ場合の所要分 */
  flightMinutes: number;
  domestic: boolean;
}

/**
 * 学習時間で飛べる行き先の候補。
 * 所要時間が学習時間に近い空港を、まずは ±15%（最低±5分）で探し、少なければ許容幅を広げる。
 */
export function destinationCandidates(origin: Airport, minutes: number, airports: readonly Airport[], opts: { limit?: number; minResults?: number } = {}): Candidate[] {
  const limit = opts.limit ?? 60;
  const minResults = opts.minResults ?? 8;
  const all: Candidate[] = [];
  for (const a of airports) {
    if (a.id === origin.id || !isDestinationAirport(a)) continue;
    const distanceKm = haversineKm(pos(origin), pos(a));
    if (distanceKm < 30) continue; // 同じ都市圏の空港への移動は除外
    all.push({ airport: a, distanceKm, flightMinutes: flightMinutesFor(distanceKm), domestic: a.countryCode === origin.countryCode });
  }
  let picked: Candidate[] = [];
  for (const ratio of [0.15, 0.3, 0.5, 0.8]) {
    const tol = Math.max(5, minutes * ratio);
    picked = all.filter((c) => Math.abs(c.flightMinutes - minutes) <= tol);
    if (picked.length >= minResults) break;
  }
  if (picked.length < minResults) {
    // それでも少ない（離島・極地など）場合は所要時間が近い順に補う
    picked = [...all].sort((a, b) => Math.abs(a.flightMinutes - minutes) - Math.abs(b.flightMinutes - minutes)).slice(0, minResults);
  }
  const score = (c: Candidate) => Math.abs(c.flightMinutes - minutes) / Math.max(1, minutes) - (c.airport.type === "large_airport" ? 0.12 : 0);
  return picked.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

/** 実際に着陸した空港（ダイバート時は landedAirportId）。 */
export function arrivalAirportId(s: Pick<FlightSession, "landedAirportId" | "destinationAirportId">): string {
  return s.landedAirportId ?? s.destinationAirportId;
}

export function arrivalCode(s: Pick<FlightSession, "landedCode" | "destinationCode">): string {
  return s.landedCode ?? s.destinationCode;
}

/** 現在地: 最後に完了したフライトの着陸空港。まだ無ければホーム空港。 */
export function currentLocationId(sessions: readonly FlightSession[], homeAirportId?: string | null): string | null {
  let last: FlightSession | null = null;
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    if (!last || (s.completedAt ?? "") > (last.completedAt ?? "")) last = s;
  }
  return last ? arrivalAirportId(last) : (homeAirportId ?? null);
}

/** 旅の軌跡（空港 ID の列）。連続していない区間（出発地を手動で変えた場合）は区切りとして null を挟む。 */
export function journeyTrail(sessions: readonly FlightSession[]): (string | null)[] {
  const done = sessions.filter((s) => s.status === "completed").sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const trail: (string | null)[] = [];
  for (const s of done) {
    const last = trail[trail.length - 1];
    if (last === undefined) trail.push(s.originAirportId);
    else if (last !== s.originAirportId) trail.push(null, s.originAirportId);
    trail.push(arrivalAirportId(s));
  }
  return trail;
}

/** 位置に最も近い目的地空港（早期着陸のダイバート先）。 */
export function nearestAirport(position: LngLat, airports: readonly Airport[]): Airport | null {
  let best: Airport | null = null;
  let bestKm = Infinity;
  for (const a of airports) {
    if (!isDestinationAirport(a)) continue;
    const km = haversineKm(position, pos(a));
    if (km < bestKm) {
      bestKm = km;
      best = a;
    }
  }
  return best;
}
