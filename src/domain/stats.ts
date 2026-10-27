// 学習統計。原本（completed セッション + focusSegments）から毎回再計算する。PRODUCT_SPEC §8–9。
//
// 日付跨ぎは focusSegments を設定タイムゾーンの暦日で分割し、セッションの
// actualFocusSeconds（整数秒）を最大剰余法で各日に配分する。これにより
// ログ・分析・目標・パスポートの数字が必ず一致する。

import { arrivalAirportId } from "./route-planner";
import type { FlightSession, FocusSegment, UUID } from "./types";
import { addDays, dayKey, daysBetween, monthKey, splitIntervalByDay, weekdayIndex, weekStart, zonedParts, type DayKey } from "./zoned";

export interface DayBucket {
  total: number;
  bySubject: Map<UUID, number>;
  sessions: Set<UUID>;
}

export type DailyTotals = Map<DayKey, DayBucket>;

/** 1セッションの集中秒を暦日ごとに配分する（合計は actualFocusSeconds に厳密一致）。 */
export function allocateSessionByDay(session: FlightSession, segments: FocusSegment[], tz: string): Map<DayKey, number> {
  const result = new Map<DayKey, number>();
  const total = Math.max(0, Math.floor(session.actualFocusSeconds ?? 0));
  if (total === 0) return result;

  const raw = new Map<DayKey, number>();
  for (const seg of segments) {
    if (!seg.endedAt) continue;
    const start = Date.parse(seg.startedAt);
    const end = Date.parse(seg.endedAt);
    for (const part of splitIntervalByDay(start, end, tz)) raw.set(part.day, (raw.get(part.day) ?? 0) + part.seconds);
  }
  const rawSum = [...raw.values()].reduce((a, b) => a + b, 0);
  if (rawSum <= 0) {
    // セグメントが無い（インポート等）場合は完了日に計上
    const at = Date.parse(session.completedAt ?? session.startedAt ?? session.createdAt);
    result.set(dayKey(at, tz), total);
    return result;
  }
  const entries = [...raw.entries()].map(([day, sec]) => {
    const exact = (sec / rawSum) * total;
    return { day, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let rest = total - entries.reduce((a, e) => a + e.floor, 0);
  entries.sort((a, b) => b.frac - a.frac || a.day.localeCompare(b.day));
  for (const e of entries) {
    const add = rest > 0 ? 1 : 0;
    rest -= add;
    if (e.floor + add > 0) result.set(e.day, e.floor + add);
  }
  return result;
}

export function groupSegments(segments: FocusSegment[]): Map<UUID, FocusSegment[]> {
  const map = new Map<UUID, FocusSegment[]>();
  for (const s of segments) {
    const list = map.get(s.sessionId);
    if (list) list.push(s);
    else map.set(s.sessionId, [s]);
  }
  return map;
}

export function buildDailyTotals(sessions: FlightSession[], segments: FocusSegment[], tz: string): DailyTotals {
  const bySession = groupSegments(segments);
  const totals: DailyTotals = new Map();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    for (const [day, sec] of allocateSessionByDay(s, bySession.get(s.id) ?? [], tz)) {
      let bucket = totals.get(day);
      if (!bucket) {
        bucket = { total: 0, bySubject: new Map(), sessions: new Set() };
        totals.set(day, bucket);
      }
      bucket.total += sec;
      bucket.bySubject.set(s.subjectId, (bucket.bySubject.get(s.subjectId) ?? 0) + sec);
      bucket.sessions.add(s.id);
    }
  }
  return totals;
}

export function sumRange(totals: DailyTotals, from: DayKey, to: DayKey): number {
  let sum = 0;
  for (const [day, b] of totals) if (day >= from && day <= to) sum += b.total;
  return sum;
}

export function subjectBreakdown(totals: DailyTotals, from: DayKey, to: DayKey): Map<UUID, number> {
  const map = new Map<UUID, number>();
  for (const [day, b] of totals) {
    if (day < from || day > to) continue;
    for (const [sid, sec] of b.bySubject) map.set(sid, (map.get(sid) ?? 0) + sec);
  }
  return map;
}

export function dailySeries(totals: DailyTotals, today: DayKey, days: number): { day: DayKey; seconds: number }[] {
  const out: { day: DayKey; seconds: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, seconds: totals.get(day)?.total ?? 0 });
  }
  return out;
}

export type Period = "today" | "week" | "month";

export function periodRange(period: Period, today: DayKey): { from: DayKey; to: DayKey } {
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const from = weekStart(today);
    return { from, to: addDays(from, 6) };
  }
  const from = `${monthKey(today)}-01`;
  return { from, to: `${monthKey(today)}-31` };
}

/**
 * 連続学習日数。minSeconds 以上の日を達成日とする。
 * 今日がまだ未達でも、昨日まで続いていれば継続中として数える。
 */
export function computeStreaks(totals: DailyTotals, today: DayKey, minSeconds: number): { current: number; longest: number; todayAchieved: boolean } {
  const achieved = [...totals.entries()]
    .filter(([, b]) => b.total >= minSeconds)
    .map(([d]) => d)
    .sort();
  let longest = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const d of achieved) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const set = new Set(achieved);
  const todayAchieved = set.has(today);
  let current = 0;
  let cursor = todayAchieved ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, todayAchieved };
}

/** 曜日（0=月）×時間帯の集中秒（ヒートマップ用）。 */
export function hourHeatmap(sessions: FlightSession[], segments: FocusSegment[], tz: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const completed = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.id));
  for (const seg of segments) {
    if (!seg.endedAt || !completed.has(seg.sessionId)) continue;
    let t = Date.parse(seg.startedAt);
    const end = Date.parse(seg.endedAt);
    for (let guard = 0; guard < 2000 && t < end; guard++) {
      // 1時間未満のオフセットを持つタイムゾーンにも対応するため、15分刻みで進める
      const next = Math.min(end, (Math.floor(t / 900_000) + 1) * 900_000);
      const p = zonedParts(t, tz);
      grid[weekdayIndex(dayKey(t, tz))][p.hour] += (next - t) / 1000;
      t = next;
    }
  }
  return grid;
}

export interface TotalsSummary {
  completedFlights: number;
  totalFocusSeconds: number;
  totalPoints: number;
  totalDistanceKm: number;
  longestFlightKm: number;
  longestSessionSeconds: number;
}

export function summarize(sessions: FlightSession[]): TotalsSummary {
  const done = sessions.filter((s) => s.status === "completed");
  return {
    completedFlights: done.length,
    totalFocusSeconds: done.reduce((a, s) => a + (s.actualFocusSeconds ?? 0), 0),
    totalPoints: done.reduce((a, s) => a + (s.earnedSkyPoints ?? 0), 0),
    totalDistanceKm: done.reduce((a, s) => a + s.distanceKm, 0),
    longestFlightKm: done.reduce((a, s) => Math.max(a, s.distanceKm), 0),
    longestSessionSeconds: done.reduce((a, s) => Math.max(a, s.actualFocusSeconds ?? 0), 0),
  };
}

/** 完了フライトで訪れた空港（出発地・到着地）と、その初訪問日時。 */
export function visitedAirports(sessions: FlightSession[]): Map<string, { firstVisitedAt: string; visits: number }> {
  const map = new Map<string, { firstVisitedAt: string; visits: number }>();
  const done = sessions.filter((s) => s.status === "completed").sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  for (const s of done) {
    for (const id of [s.originAirportId, arrivalAirportId(s)]) {
      const cur = map.get(id);
      if (cur) cur.visits++;
      else map.set(id, { firstVisitedAt: s.completedAt ?? s.updatedAt, visits: 1 });
    }
  }
  return map;
}
