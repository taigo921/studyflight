"use client";

import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressRing";
import { Stepper } from "@/components/ui/Stepper";
import { updateGoals } from "@/data/settings";
import { formatDuration, percent } from "@/domain/format";
import { addDays, weekStart } from "@/domain/zoned";
import { useGoals } from "@/features/data-hooks";
import { useNow } from "@/features/useNow";
import { useStats } from "@/features/useStats";

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

export function GoalsScreen() {
  const goals = useGoals();
  const stats = useStats(useNow(60_000));
  const daily = stats ? stats.todaySeconds / Math.max(1, stats.dailyGoalSeconds) : 0;
  const weekly = stats ? stats.weekSeconds / Math.max(1, stats.weeklyGoalSeconds) : 0;
  const start = stats ? weekStart(stats.today) : null;

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="目標" back="/" />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center gap-2 p-4">
            <ProgressRing value={daily} size={104} stroke={9} label={`今日の達成率 ${percent(daily)}`} color={daily >= 1 ? "var(--color-ok)" : "var(--color-sky)"}>
              <span className="tabular text-lg font-bold">{percent(daily)}</span>
            </ProgressRing>
            <p className="text-sm font-semibold">今日</p>
            <p className="tabular text-xs text-mute">
              {formatDuration(stats?.todaySeconds ?? 0)} / {formatDuration(goals.dailyFocusMinutes * 60)}
            </p>
          </Card>
          <Card className="flex flex-col items-center gap-2 p-4">
            <ProgressRing value={weekly} size={104} stroke={9} label={`今週の達成率 ${percent(weekly)}`} color={weekly >= 1 ? "var(--color-ok)" : "var(--color-gold)"}>
              <span className="tabular text-lg font-bold">{percent(weekly)}</span>
            </ProgressRing>
            <p className="text-sm font-semibold">今週</p>
            <p className="tabular text-xs text-mute">
              {formatDuration(stats?.weekSeconds ?? 0)} / {formatDuration(goals.weeklyFocusMinutes * 60)}
            </p>
          </Card>
        </div>

        {stats && start && (
          <Card>
            <SectionTitle>今週の達成状況</SectionTitle>
            <ul className="grid grid-cols-7 gap-1.5">
              {DAYS.map((label, i) => {
                const day = addDays(start, i);
                const sec = stats.totals.get(day)?.total ?? 0;
                const r = sec / Math.max(1, stats.dailyGoalSeconds);
                const future = day > stats.today;
                return (
                  <li key={day} className="flex flex-col items-center gap-1.5">
                    <span className={`text-xs ${day === stats.today ? "font-bold text-ink" : "text-mute"}`}>{label}</span>
                    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-elevated" aria-label={`${label}曜 ${formatDuration(sec)}`} role="img">
                      <div className="absolute inset-x-0 bottom-0 rounded-lg" style={{ height: `${Math.min(1, r) * 100}%`, background: r >= 1 ? "var(--color-ok)" : "#3987e5", opacity: future ? 0.3 : 1 }} />
                    </div>
                    <span className="tabular text-[10px] text-mute">{Math.floor(sec / 60)}分</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <SectionTitle>目標を設定</SectionTitle>
          <Stepper label="1日の目標" value={goals.dailyFocusMinutes} min={5} max={720} step={15} unit="分" onChange={(v) => updateGoals({ dailyFocusMinutes: v })} />
          <Stepper label="1週間の目標" value={goals.weeklyFocusMinutes} min={30} max={5040} step={30} unit="分" onChange={(v) => updateGoals({ weeklyFocusMinutes: v })} />
          <div className="border-t border-line/60 pt-4">
            <Stepper label="連続日数の条件" value={goals.minimumStreakMinutes} min={1} max={240} step={5} unit="分/日" onChange={(v) => updateGoals({ minimumStreakMinutes: v })} />
            <p className="mt-2 text-xs text-mute">1日の完了フライトの合計がこの時間以上なら、その日を「学習した日」として連続日数に数えます。</p>
          </div>
          {stats && <ProgressBar value={stats.streak.todayAchieved ? 1 : (stats.totals.get(stats.today)?.total ?? 0) / (goals.minimumStreakMinutes * 60)} color="var(--color-gold)" label="今日の連続日数条件の達成度" />}
        </Card>
      </div>
    </main>
  );
}
