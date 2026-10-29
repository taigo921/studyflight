"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlightMap } from "@/components/flight/FlightMap";
import { IconClose, IconFollow, IconLanding, IconLayers, IconMute, IconPause, IconPlay, IconRoute, IconSound, IconWindow } from "@/components/icons/Icons";
import { MapStyleSheet } from "@/components/flight/MapStyleSheet";
import { WindowFrame } from "@/components/flight/WindowFrame";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import { CrewStrip } from "@/components/social/CrewStrip";
import { updatePreferences } from "@/data/settings";
import { abandonFlight, ARRIVE_IF_PROGRESS_AT_LEAST, completeIfDue, landFlightEarly, pauseFlight, resumeFlight } from "@/data/sessions";
import { airportCodeOf } from "@/domain/airport-search";
import { formatClock, formatLatLng, percent } from "@/domain/format";
import { flightPositionAt, nearest, type LngLat } from "@/domain/geo";
import { earlyLandingOutcome, elapsedSeconds, hasClockAnomaly, legProgressOf, remainingSeconds } from "@/domain/session";
import type { FlightCamera, SoundMode } from "@/domain/types";
import { usePreferences, useSession } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { useNow } from "@/features/useNow";
import { useWakeLock } from "@/features/useWakeLock";
import { AmbientSound, SOUND_LABELS } from "@/lib/sound";
import { confirmDialog, toast } from "@/store/ui";

const clockFmt = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" });
const clockTime = (ms: number) => clockFmt.format(ms);

export function FlightScreen() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const session = useSession(id);
  const prefs = usePreferences();
  const { byId, airports } = useAirports();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [playing, setPlaying] = useState<SoundMode>("off");
  const [styleOpen, setStyleOpen] = useState(false);
  const sound = useRef<AmbientSound | null>(null);
  const landing = useRef(false);
  // 地図は毎フレーム進捗を読むので、最新のセッションを ref 経由で渡す
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });
  // 地図・距離は区間全体の進捗（分割飛行では前回の続きから）
  const getProgress = useCallback(() => (sessionRef.current ? legProgressOf(sessionRef.current, Date.now()) : 0), []);
  const tileWarned = useRef(false);
  const onTileTrouble = useCallback(() => {
    if (tileWarned.current) return;
    tileWarned.current = true;
    toast("衛星画像を読み込めません。通信状況を確認するか、地図を「地球」に切り替えてください", "error");
  }, []);

  const isActive = session?.status === "active";

  // 現在位置と最寄りの空港（0.1度単位で再計算）
  const here = useMemo(() => {
    if (!session) return null;
    const o = byId.get(session.originAirportId);
    const d = byId.get(session.destinationAirportId);
    if (!o || !d) return null;
    return flightPositionAt([o.lng, o.lat], [d.lng, d.lat], legProgressOf(session, now)).position;
  }, [session, byId, now]);
  const hereKey = here ? `${here[0].toFixed(1)},${here[1].toFixed(1)}` : "";
  const near = useMemo(() => {
    if (!hereKey) return null;
    const [lng, lat] = hereKey.split(",").map(Number);
    return nearest([lng, lat], airports);
  }, [hereKey, airports]);
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
  const progress = legProgressOf(session, now);
  const remaining = remainingSeconds(session, now);
  const elapsed = elapsedSeconds(session, now);
  const pos = origin && destination ? flightPositionAt(origin, destination, progress) : null;
  const routeKm = session.routeDistanceKm ?? session.distanceKm;
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
    // 機体は上空で止まらない: 目的地の手前で終えるときは、いまの位置から最寄りの空港へ降りる
    const divert = near ? { id: near.item.id, code: airportCodeOf(near.item) } : null;
    const divertName = near ? `${near.item.nameJa ?? near.item.name}（${airportCodeOf(near.item)}）` : "空港";
    const toDestination = !divert || divert.id === session.destinationAirportId || legProgressOf(session, Date.now()) >= ARRIVE_IF_PROGRESS_AT_LEAST;
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
            message:
              toDestination
                ? `ここまでの集中時間 ${formatClock(elapsedSeconds(session, Date.now()))} を記録して、${session.destinationCode} に着陸します。`
                : `ここまでの集中時間 ${formatClock(elapsedSeconds(session, Date.now()))} を記録します。${session.destinationCode} の手前なので、最寄りの${divertName}にダイバートして着陸し、次はそこから出発します。`,
            confirmLabel: "着陸する",
          },
    );
    if (!ok) return;
    await run(async () => {
      const r = await landFlightEarly(session.id, undefined, toDestination ? null : divert);
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

  const cameraOptions: { id: FlightCamera; label: string; icon: React.ReactNode }[] = [
    { id: "follow", label: "機体を追う", icon: <IconFollow size={20} /> },
    { id: "overview", label: "航路全体", icon: <IconRoute size={20} /> },
    { id: "window", label: "窓から見る", icon: <IconWindow size={20} /> },
  ];
  const glass = "inline-flex size-12 items-center justify-center rounded-full border border-white/15 bg-night/55 text-ink shadow-lg backdrop-blur-md transition-colors hover:bg-night/75";

  return (
    <main className="relative h-dvh overflow-hidden bg-night select-none" data-testid="flight-screen" data-status={session.status}>
      {origin && destination ? (
        <FlightMap
          origin={origin}
          destination={destination}
          originCode={session.originCode}
          destinationCode={session.destinationCode}
          progress={progress}
          getProgress={getProgress}
          plannedSeconds={session.legScheduledSeconds ?? session.plannedSeconds}
          mapMode={prefs.mapMode}
          quality={prefs.renderQuality}
          styleId={prefs.mapStyle}
          labels={prefs.mapLabels}
          camera={prefs.flightCamera}
          reducedMotion={prefs.reducedMotion}
          onTileTrouble={onTileTrouble}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-mute">航路データを読み込み中…</div>
      )}
      {prefs.flightCamera === "window" && <WindowFrame />}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] h-36 bg-gradient-to-b from-night/80 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[30rem] bg-gradient-to-t from-night/95 via-night/80 to-transparent short:h-48" aria-hidden />

      {/* 上部: 閉じる・便情報 */}
      <header className="px-safe pt-safe absolute inset-x-0 top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" aria-label="ホームへ（フライトは続きます）" className={glass}>
            <IconClose size={20} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="tabular text-xl leading-tight font-bold tracking-wider drop-shadow">
              {session.originCode} <span className="text-gold">→</span> {session.destinationCode}
            </p>
            <div className="mt-1 flex justify-center">
              <SubjectBadge name={session.subjectName} color={session.subjectColor} size="sm" />
            </div>
            {session.groupId && <CrewStrip groupId={session.groupId} />}
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={() => setStyleOpen(true)} aria-label="地図の見た目を変える" className={glass}>
              <IconLayers size={20} />
            </button>
            <button type="button" onClick={() => setStyleOpen(true)} className="min-h-6 rounded-full px-2 text-[10px] text-mute/90" aria-label="地図の出典を表示">
              ⓘ 出典
            </button>
          </div>
        </div>
      </header>

      {/* 左: 停止・サウンド */}
      <div className="absolute top-[40%] z-10 flex -translate-y-1/2 flex-col gap-3 short:top-1/2" style={{ left: "max(var(--safe-left), 14px)" }}>
        {paused ? (
          <button type="button" className={`${glass} !bg-gold !text-night`} disabled={busy} onClick={() => run(() => resumeFlight(session.id), "再開できませんでした")} aria-label="再開">
            <IconPlay size={20} />
          </button>
        ) : (
          <button type="button" className={glass} disabled={busy} onClick={() => run(() => pauseFlight(session.id), "一時停止できませんでした")} aria-label="一時停止">
            <IconPause size={20} />
          </button>
        )}
        <button type="button" className={glass} onClick={() => setSoundOpen(true)} aria-label={`サウンド: ${SOUND_LABELS[playing]}`}>
          {playing === "off" ? <IconMute size={20} /> : <IconSound size={20} />}
        </button>
      </div>

      {/* 右: カメラ */}
      <div
        role="radiogroup"
        aria-label="カメラ"
        className="absolute top-[40%] z-10 flex -translate-y-1/2 flex-col gap-1 rounded-full short:top-1/2 border border-white/15 bg-night/55 p-1 shadow-lg backdrop-blur-md"
        style={{ right: "max(var(--safe-right), 14px)" }}
      >
        {cameraOptions.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={prefs.flightCamera === c.id}
            aria-label={c.label}
            onClick={() => updatePreferences({ flightCamera: c.id })}
            className={`inline-flex size-11 items-center justify-center rounded-full transition-colors ${prefs.flightCamera === c.id ? "bg-gold text-night" : "text-ink hover:bg-white/10"}`}
          >
            {c.icon}
          </button>
        ))}
      </div>

      {/* 下部: 残り時間・残り距離・着陸 */}
      <section className="px-safe pb-safe pointer-events-none absolute inset-x-0 bottom-0 z-10 [&_button]:pointer-events-auto" aria-label="フライト情報と操作">
        <div className="mx-auto flex max-w-xl flex-col gap-3 short:max-w-3xl short:gap-2">
          {anomaly && (
            <p className="rounded-2xl border border-gold/40 bg-night/80 px-3 py-2 text-xs text-gold" role="alert">
              端末の時刻が出発時刻より前に戻っています。経過時間は0未満にならないよう補正されます。
            </p>
          )}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold ${paused ? "text-gold" : "text-mute"}`} aria-live="polite">
                {paused ? "一時停止中" : "残り時間"}
              </p>
              <p className="tabular text-[44px] leading-none font-bold tracking-tight drop-shadow short:text-[32px]" role="timer" aria-label={`残り時間 ${formatClock(remaining)}`} data-testid="remaining">
                {formatClock(remaining)}
              </p>
              <p className="tabular mt-1 text-xs text-mute">
                経過 <span data-testid="elapsed">{formatClock(elapsed)}</span> · <span data-testid="progress">{percent(progress)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-mute">残り距離</p>
              <p className="tabular text-[32px] leading-none font-bold drop-shadow short:text-[26px]">
                {Math.round(pos ? pos.remainingKm : routeKm * (1 - progress)).toLocaleString("ja-JP")}
                <span className="ml-1 text-base text-mute">km</span>
              </p>
            </div>
          </div>
          <div className="tabular flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-mute" data-testid="flight-eta">
            <span>
              {paused ? "一時停止中は到着時刻が後ろにずれます" : `到着予定 ${clockTime(now + remaining * 1000)}`}
            </span>
            {pos && (
              <span className="min-w-0 truncate">
                現在地 {formatLatLng(pos.position[0], pos.position[1], 1)}
                {near && near.km < 400 ? ` · ${near.item.nameJa ?? near.item.municipality ?? near.item.name}（${airportCodeOf(near.item)}）${near.km < 15 ? "付近" : `から${Math.round(near.km)}km`}` : ""}
              </span>
            )}
          </div>
          <ProgressBar value={progress} color="var(--color-gold)" label="飛行の進捗" />
          <div className="flex items-center gap-3 short:justify-center">
            <Button size="lg" variant="gold" disabled={busy} onClick={onLand} aria-label="早期着陸" className="flex-1 short:min-h-11 short:flex-none short:px-8">
              <IconLanding size={20} /> 着陸する
            </Button>
            <button type="button" onClick={onAbandon} disabled={busy} className="min-h-11 shrink-0 rounded-xl px-3 text-xs text-danger/90 hover:text-danger">
              破棄
            </button>
          </div>
          <p className="text-[10px] text-mute/80 short:hidden">画面を閉じてもタイマーは時刻にもとづいて進みます。航路・高度・景色は演出です。</p>
        </div>
      </section>

      <MapStyleSheet
        open={styleOpen}
        onClose={() => setStyleOpen(false)}
        value={prefs.mapStyle}
        labels={prefs.mapLabels}
        onChange={(v) => {
          void updatePreferences({ mapStyle: v });
          setStyleOpen(false);
        }}
        onLabels={(v) => void updatePreferences({ mapLabels: v })}
      />

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
