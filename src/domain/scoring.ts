// SkyPoints・ランク・実績。PRODUCT_SPEC §8。

import type { FlightSession } from "./types";

export const POINTS_PER_FULL_MINUTE = 1;
export const ARRIVAL_BONUS_POINTS = 10;
export const ARRIVAL_BONUS_MIN_PLANNED_SECONDS = 20 * 60;
export const ARRIVAL_BONUS_MIN_RATIO = 0.8;

/** 完了時に一度だけ計算して固定する。completed 以外は 0。 */
export function computeSkyPoints(session: Pick<FlightSession, "status" | "actualFocusSeconds" | "plannedSeconds">): number {
  if (session.status !== "completed") return 0;
  const actual = Math.max(0, session.actualFocusSeconds ?? 0);
  const base = Math.floor(actual / 60) * POINTS_PER_FULL_MINUTE;
  const bonus =
    session.plannedSeconds >= ARRIVAL_BONUS_MIN_PLANNED_SECONDS && actual >= session.plannedSeconds * ARRIVAL_BONUS_MIN_RATIO
      ? ARRIVAL_BONUS_POINTS
      : 0;
  return base + bonus;
}

export function hasArrivalBonus(session: Pick<FlightSession, "status" | "actualFocusSeconds" | "plannedSeconds">): boolean {
  return computeSkyPoints(session) - Math.floor(Math.max(0, session.actualFocusSeconds ?? 0) / 60) > 0;
}

export interface Rank {
  id: string;
  label: string;
  labelJa: string;
  minPoints: number;
}

export const RANKS: readonly Rank[] = [
  { id: "cadet", label: "Cadet", labelJa: "訓練生", minPoints: 0 },
  { id: "navigator", label: "Navigator", labelJa: "航法士", minPoints: 100 },
  { id: "first_officer", label: "First Officer", labelJa: "副操縦士", minPoints: 500 },
  { id: "captain", label: "Captain", labelJa: "機長", minPoints: 1500 },
];

export function rankFor(points: number): { rank: Rank; next: Rank | null; progressToNext: number } {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].minPoints) idx = i;
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const progressToNext = next ? (points - rank.minPoints) / (next.minPoints - rank.minPoints) : 1;
  return { rank, next, progressToNext: Math.min(1, Math.max(0, progressToNext)) };
}

export interface AchievementInput {
  completedFlights: number;
  totalFocusSeconds: number;
  visitedAirports: number;
  visitedCountries: number;
  longestStreak: number;
  longestFlightKm: number;
  longestSessionSeconds: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
}

const ratio = (v: number, target: number) => Math.min(1, v / target);

export function computeAchievements(i: AchievementInput): Achievement[] {
  const defs: [string, string, string, number, number][] = [
    ["first_flight", "初フライト", "最初のフライトを完了する", i.completedFlights, 1],
    ["ten_landings", "10回着陸", "フライトを10回完了する", i.completedFlights, 10],
    ["fifty_landings", "50回着陸", "フライトを50回完了する", i.completedFlights, 50],
    ["five_airports", "5空港訪問", "5つの空港を訪れる", i.visitedAirports, 5],
    ["three_countries", "3か国訪問", "3つの国・地域を訪れる", i.visitedCountries, 3],
    ["thousand_minutes", "1000分達成", "累計1000分集中する", i.totalFocusSeconds / 60, 1000],
    ["streak_7", "7日連続", "7日連続で学習目標の最小時間を達成する", i.longestStreak, 7],
    ["deep_focus", "ディープフォーカス", "1回で90分以上集中する", i.longestSessionSeconds / 60, 90],
    ["long_haul", "長距離便", "5000km以上のフライトを完了する", i.longestFlightKm, 5000],
  ];
  return defs.map(([id, title, description, value, target]) => ({
    id,
    title,
    description,
    achieved: value >= target,
    progress: ratio(value, target),
  }));
}
