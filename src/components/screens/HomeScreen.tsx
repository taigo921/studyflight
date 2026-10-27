"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { FlightStub } from "@/components/flight/FlightStub";
import { JourneyCard } from "@/components/flight/JourneyCard";
import { useAirports } from "@/features/useAirports";
import { travelState } from "@/domain/route-planner";
import { IconChevronRight, IconPlane, IconSettings, IconStreak, IconTarget } from "@/components/icons/Icons";
import { LinkButton } from "@/components/ui/Button";
import { Card, EmptyState, SectionTitle } from "@/components/ui/Card";
import { ProgressBar, ProgressRing } from "@/components/ui/ProgressRing";
import { useActiveTrip, useBoardingFlight, useLegs, useOpenFlight, usePreferences } from "@/features/data-hooks";
import { useNow } from "@/features/useNow";
import { useStats } from "@/features/useStats";
import { formatClock, formatDuration, percent } from "@/domain/format";
import { remainingSeconds } from "@/domain/session";

export function HomeScreen() {
  const now = useNow(1000);
  const stats = useStats(now);
  const open = useOpenFlight();
  const boarding = useBoardingFlight();
  const prefs = usePreferences();
  const { byId } = useAirports();
  const legs = useLegs();
  const trip = useActiveTrip();
  const travel = stats && legs ? travelState(stats.sessions, legs, prefs.homeAirportId) : null;
  const currentId = travel?.kind === "ground" ? travel.airportId : null;
  const currentAirport = currentId ? (byId.get(currentId) ?? null) : null;

  const todayRatio = stats ? stats.todaySeconds / Math.max(1, stats.dailyGoalSeconds) : 0;
  const leftSeconds = stats ? Math.max(0, stats.dailyGoalSeconds - stats.todaySeconds) : 0;
  const dateLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: stats?.timezone, month: "long", day: "numeric", weekday: "short" }).format(now);
  const recent = (stats?.sessions ?? []).filter((s) => s.status === "completed" || s.status === "abandoned").slice(0, 3);

  return (
    <main className="px-safe relative mx-auto max-w-xl overflow-hidden">
      <div className="earth-arc" aria-hidden />
      <header className="pt-safe relative mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark size={34} />
          <div>
            <p className="text-[12px] leading-tight text-mute">{dateLabel}</p>
            <p className="text-[17px] leading-tight font-bold tracking-tight">StudyFlight</p>
          </div>
        </div>
        <Link href="/settings/" aria-label="設定" className="inline-flex size-11 items-center justify-center rounded-full text-mute hover:bg-elevated hover:text-ink">
          <IconSettings />
        </Link>
      </header>

      <div className="relative flex flex-col gap-4">
        {open && (
          <Link
            href={`/flight/?id=${open.id}`}
            className="animate-fade-up flex items-center gap-4 rounded-3xl border border-gold/40 bg-gradient-to-r from-[#2a2414] to-surface p-4 shadow-lg"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
              <IconPlane />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-gold">{open.status === "paused" ? "一時停止中のフライト" : "フライト中"}</span>
              <span className="tabular block truncate text-lg font-bold">
                {open.originCode} → {open.destinationCode}
                <span className="ml-2 text-base font-semibold text-mute">残り {formatClock(remainingSeconds(open, now))}</span>
              </span>
            </span>
            <IconChevronRight className="text-mute" />
          </Link>
        )}
        {!open && boarding && (
          <Link href="/boarding/" className="flex items-center gap-4 rounded-3xl border border-sky/40 bg-surface p-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky/15 text-sky">
              <IconPlane />
            </span>
            <span className="flex-1">
              <span className="block text-xs text-sky">搭乗手続き済み</span>
              <span className="block font-bold">
                {boarding.originCode} → {boarding.destinationCode} の出発を待っています
              </span>
            </span>
            <IconChevronRight className="text-mute" />
          </Link>
        )}

        <JourneyCard current={currentAirport} sessions={stats?.sessions ?? []} byId={byId} airLeg={travel?.kind === "air" ? travel : null} trip={trip} />

        <Card className="relative overflow-hidden">
          <div className="flex items-center gap-5">
            <ProgressRing value={todayRatio} size={116} stroke={10} label={`今日の目標達成率 ${percent(todayRatio)}`} color={todayRatio >= 1 ? "var(--color-ok)" : "var(--color-sky)"}>
              <span className="tabular text-xl font-bold">{percent(todayRatio)}</span>
              <span className="text-[11px] text-mute">今日の目標</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-mute">今日の学習時間</p>
              <p className="tabular text-[30px] leading-tight font-bold tracking-tight" data-testid="today-total">
                {stats ? formatDuration(stats.todaySeconds) : "—"}
              </p>
              <p className="mt-1 text-sm text-mute">
                {stats && leftSeconds > 0 ? (
                  <>
                    目標まであと <span className="font-semibold text-ink">{formatDuration(leftSeconds)}</span>
                  </>
                ) : (
                  <span className="font-semibold text-ok">今日の目標を達成しました</span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line/60 pt-4">
            <div className="flex items-center gap-2.5">
              <IconStreak className={stats?.streak.current ? "text-gold" : "text-mute"} />
              <div>
                <p className="text-xs text-mute">連続学習</p>
                <p className="tabular font-bold">{stats?.streak.current ?? 0}日</p>
              </div>
            </div>
            <Link href="/goals/" className="flex items-center gap-2.5 rounded-xl">
              <IconTarget className="text-sky" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-mute">今週 {stats ? `${formatDuration(stats.weekSeconds)} / ${formatDuration(stats.weeklyGoalSeconds)}` : ""}</p>
                <div className="mt-1.5">
                  <ProgressBar value={stats ? stats.weekSeconds / Math.max(1, stats.weeklyGoalSeconds) : 0} label="今週の目標達成率" />
                </div>
              </div>
            </Link>
          </div>
        </Card>

        {!open && (
          <LinkButton href="/boarding/" size="lg" className="w-full shadow-[0_10px_30px_rgba(102,179,255,0.25)]">
            <IconPlane /> {currentAirport ? `${currentAirport.iata ?? currentAirport.id} から次のフライトへ` : "新しいフライト"}
          </LinkButton>
        )}

        <section aria-labelledby="recent-title" className="mt-2">
          <SectionTitle
            action={
              <Link href="/log/" className="inline-flex min-h-11 items-center text-sm text-sky">
                すべて見る
              </Link>
            }
          >
            <span id="recent-title">最近のフライト</span>
          </SectionTitle>
          {recent.length === 0 ? (
            <EmptyState icon={<IconPlane size={28} />} title="まだフライトがありません">
              {prefs.displayName ? `${prefs.displayName}さん、` : ""}科目と目的地を選んで、最初のフライトに出発しましょう。
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.map((s) => (
                <li key={s.id}>
                  <FlightStub session={s} timezone={stats?.timezone ?? "UTC"} href={`/log/?id=${s.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
