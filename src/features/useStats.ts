"use client";

import { useMemo } from "react";
import { computeAchievements, rankFor } from "@/domain/scoring";
import { buildDailyTotals, computeStreaks, periodRange, sumRange, summarize, visitedAirports } from "@/domain/stats";
import { dayKey } from "@/domain/zoned";
import { useAirports } from "./useAirports";
import { useGoals, useSegments, useSessions } from "./data-hooks";

/** すべての画面で共通の統計。原本（sessions + focusSegments）から再計算する。 */
export function useStats(nowMs: number) {
  const sessions = useSessions();
  const segments = useSegments();
  const goals = useGoals();
  const { byId } = useAirports();
  const today = dayKey(nowMs, goals.timezone);

  return useMemo(() => {
    if (!sessions || !segments) return null;
    const totals = buildDailyTotals(sessions, segments, goals.timezone);
    const week = periodRange("week", today);
    const month = periodRange("month", today);
    const todaySeconds = totals.get(today)?.total ?? 0;
    const weekSeconds = sumRange(totals, week.from, week.to);
    const monthSeconds = sumRange(totals, month.from, month.to);
    const streak = computeStreaks(totals, today, goals.minimumStreakMinutes * 60);
    const summary = summarize(sessions);
    const visited = visitedAirports(sessions);
    const countries = new Set([...visited.keys()].map((id) => byId.get(id)?.countryCode).filter(Boolean));
    const achievements = computeAchievements({
      completedFlights: summary.completedFlights,
      totalFocusSeconds: summary.totalFocusSeconds,
      visitedAirports: visited.size,
      visitedCountries: countries.size,
      longestStreak: streak.longest,
      longestFlightKm: summary.longestFlightKm,
      longestSessionSeconds: summary.longestSessionSeconds,
    });
    return {
      sessions,
      segments,
      totals,
      today,
      todaySeconds,
      weekSeconds,
      monthSeconds,
      dailyGoalSeconds: goals.dailyFocusMinutes * 60,
      weeklyGoalSeconds: goals.weeklyFocusMinutes * 60,
      streak,
      summary,
      visited,
      countries,
      achievements,
      rank: rankFor(summary.totalPoints),
      timezone: goals.timezone,
    };
  }, [sessions, segments, goals, today, byId]);
}

export type Stats = NonNullable<ReturnType<typeof useStats>>;
