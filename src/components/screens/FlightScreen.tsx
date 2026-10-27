"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FlightMap } from "@/components/flight/FlightMap";
import { IconClose, IconLanding, IconMute, IconPause, IconPlay, IconSound } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import { updatePreferences } from "@/data/settings";
import { abandonFlight, completeIfDue, landFlightEarly, pauseFlight, resumeFlight } from "@/data/sessions";
import { formatClock, formatKm, percent } from "@/domain/format";
import { flightPositionAt, type LngLat } from "@/domain/geo";
import { earlyLandingOutcome, elapsedSeconds, hasClockAnomaly, progressOf, remainingSeconds } from "@/domain/session";
import type { SoundMode } from "@/domain/types";
import { usePreferences, useSession } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { useNow } from "@/features/useNow";
import { useWakeLock } from "@/features/useWakeLock";
import { AmbientSound, SOUND_LABELS } from "@/lib/sound";
import { confirmDialog, toast } from "@/store/ui";

export function FlightScreen() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const session = useSession(id);
  const prefs = usePreferences();
  const { byId } = useAirports();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [playing, setPlaying] = useState<SoundMode>("off");
  const sound = useRef<AmbientSound | null>(null);
  const landing = useRef(false);

  const isActive = session?.status === "active";
  useWakeLock(isActive);

  useEffect(() => () => sound.current?.dispose(), []);

  // 予定時間に到達したら着陸を確定（冪等）。別タブで完了した場合も到着画面へ。
  const due = !!session && isActive && elapsedSeconds(session, now) >= session.plannedSeconds;
  useEffect(() => {
    if (!session) return;
    if (session.status === "completed") {
      router.replace(`/arrival/?id=${session.id}`);
      return;
    }
    if (session.status === "boarding") {
      router.replace("/boarding/");
      return;
    }
    if (due && !landing.current) {
      landing.current = true;
      completeIfDue(session.id)
        .catch(() => toast("着陸処理に失敗しました。再読み込みしてください", "error"))
        .finally(() => (landing.current = false));
    }
  }, [session, due, router]);

  if (session === undefined || session?.status === "boarding" || session?.status === "completed") return <main className="min-h-dvh" aria-busy="true" />;
  if (session === null || !id) {
    return (
      <main className="px-safe pt-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold">フライトが見つかりません</p>
        <LinkButton href="/">ホームへ</LinkButton>
      </main>
    );
  }
  if (session.status === "abandoned") {
    return (
      <main className="px-safe pt-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold">このフライトは欠航扱いになりました</p>
        <p className="text-sm text-mute">記録には残りますが、学習時間・ポイントの集計対象外です。</p>
        <LinkButton href="/boarding/">新しいフライトを予約</LinkButton>
        <Link href="/" className="min-h-11 text-sm text-mute">
          ホームへ
        </Link>
      </main>
    );
  }

  const o = byId.get(session.originAirportId);
  const d = byId.get(session.destinationAirportId);
  const origin: LngLat | null = o ? [o.lng, o.lat] : null;
  const destination: LngLat | null = d ? [d.lng, d.lat] : null; // 子は値で依存するので毎回生成してよい
  const progress = progressOf(session, now);
  const remaining = remainingSeconds(session, now);
  const elapsed = elapsedSeconds(session, now);
  const pos = origin && destination ? flightPositionAt(origin, destination, progress) : null;
  const paused = session.status === "paused";
  const anomaly = hasClockAnomaly(session, now);

  const run = async (fn: () => Promise<unknown>, err: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : err, "error");
    } finally {
      setBusy(false);
    }
  };

  const onLand = async () => {
    const outcome = earlyLandingOutcome(session, Date.now(), prefs.earlyLandingMinSeconds);
    const minMin = Math.round(prefs.earlyLandingMinSeconds / 60);
    const ok = await confirmDialog(
      outcome === "abandoned"
        ? {
            title: "早期着陸しますか？",
            message: `集中時間が${minMin}分未満のため、このフライトは欠航扱い（学習時間・ポイントの対象外）になります。`,
            confirmLabel: "欠航にする",
            tone: "danger",
          }
        : {
            title: "早期着陸しますか？",
            message: `ここまでの集中時間 ${formatClock(elapsedSeconds(session, Date.now()))} を記録して着陸します。`,
            confirmLabel: "着陸する",
          },
    );
    if (!ok) return;
    await run(async () => {
      const r = await landFlightEarly(session.id);
      if (r.status === "abandoned") router.replace("/");
    }, "着陸できませんでした");
  };

  const onAbandon = async () => {
    const ok = await confirmDialog({
      title: "フライトを破棄しますか？",
      message: "このフライトは欠航扱いとなり、学習時間・ポイント・連続日数の対象外になります。",
      confirmLabel: "破棄する",
      tone: "danger",
    });
    if (!ok) return;
    await run(async () => {
      await abandonFlight(session.id);
      sound.current?.stop();
      router.replace("/");
    }, "破棄できませんでした");
  };

  const chooseSound = async (mode: SoundMode) => {
    setSoundOpen(false);
    void updatePreferences({ soundMode: mode });
    if (mode === "off") {
      sound.current?.stop();
      setPlaying("off");
      return;
    }
    try {
      sound.current ??= new AmbientSound();
      await sound.current.start(mode);
      setPlaying(mode);
    } catch {
      toast("この端末ではサウンドを再生できません", "error");
    }
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-night select-none" data-testid="flight-screen" data-status={session.status}>
      {origin && destination ? (
        <FlightMap
          origin={origin}
          destination={destination}
          originCode={session.originCode}
          destinationCode={session.destinationCode}
          progress={progress}
          mapMode={prefs.mapMode}
          reducedMotion={prefs.reducedMotion}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-mute">航路データを読み込み中…</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-night via-night/70 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-night via-night/85 to-transparent" aria-hidden />

      {/* 上部 HUD */}
      <header className="px-safe pt-safe absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="tabular text-[28px] leading-tight font-bold tracking-wider">
              {session.originCode} <span className="text-sky">→</span> {session.destinationCode}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <SubjectBadge name={session.subjectName} color={session.subjectColor} size="sm" />
              {session.taskTitle && <span className="truncate text-xs text-mute">{session.taskTitle}</span>}
            </div>
            <p className="mt-1.5 text-[10px] text-mute/70">地図データ: Natural Earth（パブリックドメイン）· 航路・機影は演出です</p>
          </div>
          <Link
            href="/"
            aria-label="ホームへ（フライトは続きます）"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line/70 bg-surface/70 text-mute backdrop-blur hover:text-ink"
          >
            <IconClose />
          </Link>
        </div>
      </header>

      {/* 下部: タイマーと操作 */}
      <section className="px-safe pb-safe absolute inset-x-0 bottom-0 z-10" aria-label="フライト情報と操作">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <div className="text-center">
            <p className={`text-xs font-semibold tracking-[0.2em] ${paused ? "text-gold" : "text-sky"}`} aria-live="polite">
              {paused ? "一時停止中" : "巡航中"}
            </p>
            <p className="tabular text-[64px] leading-none font-bold tracking-tight" role="timer" aria-label={`残り時間 ${formatClock(remaining)}`} data-testid="remaining">
              {formatClock(remaining)}
            </p>
            <p className="tabular mt-1 text-sm text-mute">
              経過 <span className="text-ink" data-testid="elapsed">{formatClock(elapsed)}</span> / {formatClock(session.plannedSeconds)}
            </p>
          </div>
          <div>
            <ProgressBar value={progress} color="var(--color-gold)" label="飛行の進捗" />
            <div className="tabular mt-1.5 flex justify-between text-xs text-mute">
              <span data-testid="progress">{percent(progress)}</span>
              <span>{pos ? `残り ${formatKm(pos.remainingKm)}` : formatKm(session.distanceKm)}</span>
            </div>
          </div>

          {anomaly && (
            <p className="rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold" role="alert">
              端末の時刻が出発時刻より前に戻っています。経過時間は0未満にならないよう補正されます。
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {paused ? (
              <Button size="lg" disabled={busy} onClick={() => run(() => resumeFlight(session.id), "再開できませんでした")} aria-label="再開">
                <IconPlay size={20} /> 再開
              </Button>
            ) : (
              <Button size="lg" variant="secondary" disabled={busy} onClick={() => run(() => pauseFlight(session.id), "一時停止できませんでした")} aria-label="一時停止">
                <IconPause size={20} /> 停止
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => setSoundOpen(true)} aria-label={`サウンド: ${SOUND_LABELS[playing]}`}>
              {playing === "off" ? <IconMute size={20} /> : <IconSound size={20} />}
              <span className="text-sm">{playing === "off" ? "音" : SOUND_LABELS[playing]}</span>
            </Button>
            <Button size="lg" variant="gold" disabled={busy} onClick={onLand} aria-label="早期着陸">
              <IconLanding size={20} /> 着陸
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-mute/80">
            <p>画面を閉じてもタイマーは時刻にもとづいて進みます。実際に学習していたかは計測しません。</p>
            <button type="button" onClick={onAbandon} disabled={busy} className="min-h-11 shrink-0 rounded-xl px-2 text-xs text-danger/90 hover:text-danger">
              破棄
            </button>
          </div>
        </div>
      </section>

      <Sheet open={soundOpen} onClose={() => setSoundOpen(false)} title="サウンド">
        <div role="radiogroup" aria-label="サウンド" className="flex flex-col gap-2">
          {(["off", "cabin", "rain", "white_noise"] as SoundMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={playing === m}
              onClick={() => chooseSound(m)}
              className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left font-semibold ${playing === m ? "border-sky bg-sky/10 text-sky" : "border-line"}`}
            >
              {SOUND_LABELS[m]}
              {m === prefs.soundMode && m !== "off" && playing !== m && <span className="text-xs font-normal text-mute">前回の設定</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute">音は端末内で合成しています。iPhone ではアプリがバックグラウンドに移ると停止する場合があります。</p>
      </Sheet>
    </main>
  );
}

