"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconPlane, IconStar } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import { PLANE_PATH } from "@/components/flight/PlaneGlyph";
import { saveNote } from "@/data/sessions";
import { airportDisplayName } from "@/domain/airport-search";
import { formatDuration, formatKm, formatTime } from "@/domain/format";
import { hasArrivalBonus } from "@/domain/scoring";
import { usePreferences, useSession } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { useNow } from "@/features/useNow";
import { useStats } from "@/features/useStats";
import { toast } from "@/store/ui";

function useCountUp(target: number, enabled: boolean, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return enabled ? v : target;
}

export function ArrivalScreen() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const session = useSession(id);
  const prefs = usePreferences();
  const stats = useStats(useNow(30_000));
  const { byId } = useAirports();
  const [note, setNote] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const animate = !prefs.reducedMotion && !skipped;
  const points = useCountUp(session?.earnedSkyPoints ?? 0, animate && session?.status === "completed");

  useEffect(() => {
    if (session && session.status !== "completed") router.replace(session.status === "active" || session.status === "paused" ? `/flight/?id=${session.id}` : "/log/");
  }, [session, router]);

  if (!session || session.status !== "completed") return <main className="min-h-dvh" aria-busy="true" />;

  const dest = byId.get(session.landedAirportId ?? session.destinationAirportId);
  const planned = byId.get(session.destinationAirportId);
  const noteValue = note ?? session.note ?? "";
  const bonus = hasArrivalBonus(session);
  const tz = stats?.timezone ?? "UTC";

  const save = async (next: string) => {
    try {
      await saveNote(session.id, noteValue);
      router.push(next);
    } catch {
      toast("メモを保存できませんでした", "error");
    }
  };

  return (
    <main className="px-safe pt-safe pb-safe mx-auto flex min-h-dvh max-w-xl flex-col gap-5" onClick={() => setSkipped(true)}>
      <section className="relative mt-4 flex flex-col items-center text-center" aria-live="polite">
        <div className="relative h-28 w-full max-w-xs" aria-hidden>
          <div className="absolute inset-x-6 bottom-6 h-px bg-gradient-to-r from-transparent via-sky/70 to-transparent" />
          <div className="absolute inset-x-16 bottom-4 flex justify-between">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="h-0.5 w-3 rounded bg-gold/60" />
            ))}
          </div>
          <svg viewBox="0 0 24 24" className={`absolute bottom-7 left-1/2 size-12 -translate-x-1/2 ${animate ? "animate-landing" : ""}`}>
            <path d={PLANE_PATH} fill="#F6F8FF" transform="rotate(90 12 12)" />
          </svg>
        </div>
        <p className="text-xs font-semibold tracking-[0.25em] text-ok">{session.completionType === "early" ? "EARLY LANDING" : "ARRIVED ON TIME"}</p>
        <h1 className="mt-1 text-[26px] font-bold">{dest ? airportDisplayName(dest) : session.destinationCode} に到着</h1>
        <p className="tabular text-sm text-mute">
          {session.originCode} → {session.landedCode ?? session.destinationCode} · 着陸 {formatTime(session.completedAt, tz)}
        </p>
        {session.landedAirportId && (
          <p className="mt-2 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
            予定していた {planned ? airportDisplayName(planned) : session.destinationCode} の手前で降りたため、最寄りの空港にダイバートしました。次はここから出発します。
          </p>
        )}
      </section>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-mute">集中時間</p>
          <p className="tabular text-2xl font-bold" data-testid="arrival-focus">
            {formatDuration(session.actualFocusSeconds ?? 0)}
          </p>
          <p className="text-xs text-mute">予定 {formatDuration(session.plannedSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-mute">獲得 SkyPoints</p>
          <p className="tabular text-2xl font-bold text-gold" data-testid="arrival-points">
            +{points}
          </p>
          {bonus && (
            <p className="inline-flex items-center gap-1 text-xs text-gold">
              <IconStar size={14} /> 到着ボーナス +10
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-mute">飛行距離</p>
          <p className="tabular text-lg font-bold">{formatKm(session.distanceKm)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-mute">科目</p>
          <SubjectBadge name={session.subjectName} color={session.subjectColor} size="sm" />
          {session.taskTitle && <p className="mt-1 truncate text-xs text-mute">{session.taskTitle}</p>}
        </div>
      </Card>

      {stats && (
        <Card>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>
              ランク <span className="font-bold text-gold">{stats.rank.rank.label}</span>
              <span className="ml-1 text-xs text-mute">{stats.rank.rank.labelJa}</span>
            </span>
            <span className="tabular text-xs text-mute">累計 {stats.summary.totalPoints} SP</span>
          </div>
          <ProgressBar value={stats.rank.progressToNext} color="var(--color-gold)" label="次のランクまでの進捗" />
          {stats.rank.next && <p className="tabular mt-1.5 text-xs text-mute">{stats.rank.next.label} まであと {stats.rank.next.minPoints - stats.summary.totalPoints} SP</p>}
        </Card>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">ひとことメモ（任意）</span>
        <textarea
          value={noteValue}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="できたこと、次にやること"
          className="rounded-2xl border border-line bg-surface p-3 text-ink outline-none placeholder:text-mute/60 focus:border-sky"
        />
      </label>

      <div className="mt-auto grid grid-cols-1 gap-3 pb-2">
        <Button size="lg" onClick={() => save("/")}>
          保存して閉じる
        </Button>
        <Button size="lg" variant="secondary" onClick={() => save("/boarding/")}>
          <IconPlane size={20} /> 次のフライトを予約
        </Button>
        <LinkButton href="/analytics/" variant="ghost">
          分析を見る
        </LinkButton>
      </div>
    </main>
  );
}
