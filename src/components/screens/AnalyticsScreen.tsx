"use client";

import { useMemo, useState } from "react";
import { DailyBarChart } from "@/components/analytics/DailyBarChart";
import { HourHeatmap } from "@/components/analytics/HourHeatmap";
import { SubjectBreakdown } from "@/components/analytics/SubjectBreakdown";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { Segmented } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import { formatDuration, percent } from "@/domain/format";
import { dailySeries, hourHeatmap, periodRange, subjectBreakdown, sumRange, type Period } from "@/domain/stats";
import { addDays, daysBetween } from "@/domain/zoned";
import { useSubjects } from "@/features/data-hooks";
import { useNow } from "@/features/useNow";
import { useStats } from "@/features/useStats";

const PERIOD_LABEL: Record<Period, string> = { today: "今日", week: "今週", month: "今月" };

export function AnalyticsScreen() {
  const now = useNow(60_000);
  const stats = useStats(now);
  const subjects = useSubjects(true);
  const [period, setPeriod] = useState<Period>("week");

  const view = useMemo(() => {
    if (!stats) return null;
    const { from, to } = periodRange(period, stats.today);
    const total = sumRange(stats.totals, from, to);
    const flights = new Set<string>();
    for (const [day, b] of stats.totals) if (day >= from && day <= to) b.sessions.forEach((id) => flights.add(id));
    const goal = period === "today" ? stats.dailyGoalSeconds : period === "week" ? stats.weeklyGoalSeconds : null;
    const series =
      period === "week"
        ? Array.from({ length: 7 }, (_, i) => {
            const day = addDays(from, i);
            return { day, seconds: stats.totals.get(day)?.total ?? 0 };
          })
        : dailySeries(stats.totals, stats.today, period === "today" ? 7 : 30);
    const breakdown = subjectBreakdown(stats.totals, from, to);
    const elapsedDays = Math.max(1, daysBetween(from, stats.today) + 1);
    return { from, to, total, flights: flights.size, goal, series, breakdown, avgPerDay: total / elapsedDays };
  }, [stats, period]);

  const heat = useMemo(() => (stats ? hourHeatmap(stats.sessions, stats.segments, stats.timezone) : null), [stats]);

  const slices = useMemo(() => {
    if (!view) return [];
    return [...view.breakdown.entries()].map(([id, seconds]) => {
      const sub = subjects?.find((s) => s.id === id);
      const snap = stats?.sessions.find((s) => s.subjectId === id);
      return { id, seconds, name: sub?.name ?? snap?.subjectName ?? "不明", color: sub?.color ?? snap?.subjectColor ?? "#6b7a93" };
    });
  }, [view, subjects, stats]);

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="分析" subtitle="学習の推移" />
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-night/85 px-4 py-2 backdrop-blur">
        <Segmented<Period>
          label="期間"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: "今日" },
            { value: "week", label: "今週" },
            { value: "month", label: "今月" },
          ]}
        />
      </div>

      {!stats || !view ? (
        <div className="h-64 animate-pulse rounded-3xl bg-surface" aria-busy="true" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={`${PERIOD_LABEL[period]}の集中時間`} value={formatDuration(view.total)} />
            <StatTile label="完了フライト" value={view.flights} unit="便" />
            <StatTile label={period === "today" ? "1便あたり" : "1日あたり平均"} value={formatDuration(period === "today" ? view.total / Math.max(1, view.flights) : view.avgPerDay)} />
            <StatTile label="連続学習" value={stats.streak.current} unit="日" hint={`最長 ${stats.streak.longest}日`} />
          </div>

          {view.goal !== null && (
            <Card>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold">{period === "today" ? "今日の目標" : "今週の目標"}</span>
                <span className="tabular text-mute">
                  {formatDuration(view.total)} / {formatDuration(view.goal)} · <span className="font-semibold text-ink">{percent(view.total / Math.max(1, view.goal))}</span>
                </span>
              </div>
              <ProgressBar value={view.total / Math.max(1, view.goal)} color={view.total >= view.goal ? "var(--color-ok)" : "var(--color-sky)"} label="目標達成率" />
            </Card>
          )}

          <Card>
            <SectionTitle>{period === "today" ? "過去7日の推移" : period === "week" ? "今週の推移" : "過去30日の推移"}</SectionTitle>
            <DailyBarChart data={view.series} goalSeconds={stats.dailyGoalSeconds} today={stats.today} />
          </Card>

          <Card>
            <SectionTitle>科目別</SectionTitle>
            <SubjectBreakdown slices={slices} />
          </Card>

          <Card>
            <SectionTitle>集中する時間帯</SectionTitle>
            {heat && <HourHeatmap grid={heat} />}
          </Card>

          <p className="px-1 text-xs text-mute">集計は完了したフライトのみ。日付の区切りは設定のタイムゾーン（{stats.timezone}）、週は月曜始まりです。</p>
        </div>
      )}
    </main>
  );
}
