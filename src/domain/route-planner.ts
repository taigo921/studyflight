// 旅の現在地（地上 / 上空）と軌跡（純粋関数）。

import type { FlightLeg, FlightSession } from "./types";

/**
 * このセッションの終了時点で機体がいた空港。区間の途中で止まった場合は null（上空）。
 * 旧仕様（ダイバート）の記録は landedAirportId を優先する。
 */
export function arrivalAirportId(s: Pick<FlightSession, "landedAirportId" | "destinationAirportId" | "reachedDestination">): string | null {
  if (s.landedAirportId) return s.landedAirportId;
  return s.reachedDestination === false ? null : s.destinationAirportId;
}

export function arrivalCode(s: Pick<FlightSession, "landedCode" | "destinationCode" | "reachedDestination">): string | null {
  if (s.landedCode) return s.landedCode;
  return s.reachedDestination === false ? null : s.destinationCode;
}

export type TravelState =
  | { kind: "ground"; airportId: string | null }
  /** 区間の途中（上空で停止中）。次回はこの区間の続きを飛ぶ */
  | { kind: "air"; leg: FlightLeg; progress: number };

/**
 * 現在地。進行中の区間があれば（飛行済みなら上空、未飛行なら出発空港）。
 * なければ最後に着いた空港、まだ旅をしていなければホーム空港。
 */
export function travelState(sessions: readonly FlightSession[], legs: readonly FlightLeg[], homeAirportId?: string | null): TravelState {
  const active = legs.filter((l) => l.status === "in_progress").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (active) {
    if (active.flownSeconds > 0) return { kind: "air", leg: active, progress: Math.min(1, active.flownSeconds / active.scheduledSeconds) };
    return { kind: "ground", airportId: active.originAirportId };
  }
  let lastAt = "";
  let lastId: string | null = null;
  for (const l of legs) {
    if (l.status === "arrived" && (l.arrivedAt ?? "") > lastAt) {
      lastAt = l.arrivedAt ?? "";
      lastId = l.destinationAirportId;
    }
    // 取り消した区間は出発空港に戻った扱い
    if (l.status === "cancelled" && l.updatedAt > lastAt) {
      lastAt = l.updatedAt;
      lastId = l.originAirportId;
    }
  }
  // 区間の仕組みより前の記録（legId なし）
  for (const s of sessions) {
    if (s.status !== "completed" || s.legId) continue;
    const at = s.completedAt ?? "";
    const id = arrivalAirportId(s);
    if (id && at > lastAt) {
      lastAt = at;
      lastId = id;
    }
  }
  return { kind: "ground", airportId: lastId ?? homeAirportId ?? null };
}

/** 互換用: 地上にいるときの空港 ID（上空なら区間の出発空港）。 */
export function currentLocationId(sessions: readonly FlightSession[], homeAirportId?: string | null, legs: readonly FlightLeg[] = []): string | null {
  const st = travelState(sessions, legs, homeAirportId);
  return st.kind === "ground" ? st.airportId : st.leg.originAirportId;
}

/** 旅の軌跡（空港 ID の列）。途切れた区間は null で区切る。上空で止まっている区間は到着地を含めない。 */
export function journeyTrail(sessions: readonly FlightSession[]): (string | null)[] {
  const done = sessions.filter((s) => s.status === "completed").sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const trail: (string | null)[] = [];
  for (const s of done) {
    const last = trail[trail.length - 1];
    if (last === undefined) trail.push(s.originAirportId);
    else if (last !== s.originAirportId) trail.push(null, s.originAirportId);
    const arrived = arrivalAirportId(s);
    if (arrived) trail.push(arrived);
  }
  return trail;
}
