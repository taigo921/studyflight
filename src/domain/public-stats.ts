// フレンドに公開する学習記録の要約（端末の記録から作る）。メモ・タスク名は含めない。
// 科目名は本人が許可したときだけ含める。
import { buildDailyTotals, computeStreaks, dailySeries, summarize, visitedAirports } from "./stats";
import type { FlightSession, FocusSegment } from "./types";
import { dayKey } from "./zoned";

export interface PublicFlight {
  /** 着陸時刻（ISO） */
  at: string;
  minutes: number;
  from: string;
  to: string;
  /** 科目名（公開を許可したときだけ） */
  subject?: string;
  color?: string;
}

export interface PublicStats {
  displayName: string;
  updatedAt: string;
  totals: { focusSeconds: number; flights: number; distanceKm: number; airports: number };
  /** 直近 14 日の日別集中秒数（キーは YYYY-MM-DD） */
  days: Record<string, number>;
  recent: PublicFlight[];
  streakDays: number;
  showSubjects: boolean;
}

export const PUBLIC_DAYS = 14;
export const PUBLIC_RECENT = 20;

export function buildPublicStats(input: {
  sessions: FlightSession[];
  segments: FocusSegment[];
  timezone: string;
  nowMs: number;
  minimumStreakSeconds: number;
  displayName: string;
  showSubjects: boolean;
}): PublicStats {
  const { sessions, segments, timezone, nowMs, showSubjects } = input;
  const totals = buildDailyTotals(sessions, segments, timezone);
  const today = dayKey(nowMs, timezone);
  const summary = summarize(sessions);
  const days: Record<string, number> = {};
  for (const d of dailySeries(totals, today, PUBLIC_DAYS)) if (d.seconds > 0) days[d.day] = Math.round(d.seconds);
  const recent = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, PUBLIC_RECENT)
    .map((s): PublicFlight => {
      return {
        at: s.completedAt ?? s.updatedAt,
        minutes: Math.round((s.actualFocusSeconds ?? 0) / 60),
        from: s.originCode,
        // ダイバートした回は実際に着いた空港
        to: s.landedCode ?? s.destinationCode,
        ...(showSubjects ? { subject: s.subjectName, color: s.subjectColor } : {}),
      };
    });
  return {
    displayName: input.displayName,
    updatedAt: new Date(nowMs).toISOString(),
    totals: {
      focusSeconds: Math.round(summary.totalFocusSeconds),
      flights: summary.completedFlights,
      distanceKm: Math.round(summary.totalDistanceKm),
      airports: visitedAirports(sessions).size,
    },
    days,
    recent,
    streakDays: computeStreaks(totals, today, input.minimumStreakSeconds).current,
    showSubjects,
  };
}
