// フライトセッションの状態遷移とタイマー計算（純粋関数）。PRODUCT_SPEC §6。
//
// 真実源は永続化された時刻（activeSince, accumulatedFocusSeconds, focusSegments）。
// setInterval は表示更新にのみ使い、ここでの計算はすべて「今の時刻」を引数で受け取る。

import type { CompletionType, FlightSession, FocusSegment, ISODate, UUID } from "./types";
import { computeSkyPoints } from "./scoring";

export const DEFAULT_EARLY_LANDING_MIN_SECONDS = 5 * 60;
export const MIN_PLANNED_MINUTES = 5;
export const MAX_PLANNED_MINUTES = 240;

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

const ms = (iso: ISODate | null | undefined) => (iso ? Date.parse(iso) : NaN);
const iso = (t: number) => new Date(t).toISOString();
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** active 中の今回区間の経過秒（負値防止）。 */
function currentRunSeconds(session: FlightSession, nowMs: number): number {
  if (session.status !== "active" || !session.activeSince) return 0;
  const since = ms(session.activeSince);
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, (nowMs - since) / 1000);
}

/** 表示用の集中経過秒。 */
export function elapsedSeconds(session: FlightSession, nowMs: number): number {
  switch (session.status) {
    case "completed":
      return session.actualFocusSeconds ?? Math.min(session.plannedSeconds, session.accumulatedFocusSeconds);
    case "active":
      return Math.min(session.plannedSeconds, session.accumulatedFocusSeconds + currentRunSeconds(session, nowMs));
    case "paused":
    case "abandoned":
      return Math.min(session.plannedSeconds, session.accumulatedFocusSeconds);
    default:
      return 0;
  }
}

export function remainingSeconds(session: FlightSession, nowMs: number): number {
  return Math.max(0, session.plannedSeconds - elapsedSeconds(session, nowMs));
}

export function progressOf(session: FlightSession, nowMs: number): number {
  if (session.plannedSeconds <= 0) return 0;
  return Math.min(1, elapsedSeconds(session, nowMs) / session.plannedSeconds);
}

/** 端末時刻が activeSince より過去に戻っているか。 */
export function hasClockAnomaly(session: FlightSession, nowMs: number): boolean {
  if (session.status !== "active" || !session.activeSince) return false;
  return nowMs < ms(session.activeSince) - 1000;
}

/** active で予定時間に到達しているか（自動着陸の判定）。 */
export function isDue(session: FlightSession, nowMs: number): boolean {
  return session.status === "active" && elapsedSeconds(session, nowMs) >= session.plannedSeconds;
}

/** 予定時間に到達する時刻（active の時のみ）。 */
export function scheduledEndMs(session: FlightSession): number | null {
  if (session.status !== "active" || !session.activeSince) return null;
  return ms(session.activeSince) + (session.plannedSeconds - session.accumulatedFocusSeconds) * 1000;
}

export function isOpen(session: Pick<FlightSession, "status">): boolean {
  return session.status === "active" || session.status === "paused";
}

// ---------------------------------------------------------------------------
// 遷移結果: 新しいセッションと、focusSegments に対する操作

export interface SegmentOps {
  open?: FocusSegment;
  close?: { endedAt: ISODate; durationSeconds: number };
}

export interface TransitionResult {
  session: FlightSession;
  segments: SegmentOps;
  /** 既に目的の状態だった（冪等に何もしなかった） */
  noop?: boolean;
}

/** active 区間を閉じる時刻と秒数。計画時間を超えた分は切り捨てる。 */
function closeRun(session: FlightSession, nowMs: number): { endMs: number; seconds: number; anomaly: boolean } {
  const since = ms(session.activeSince);
  const remaining = Math.max(0, session.plannedSeconds - session.accumulatedFocusSeconds);
  if (!Number.isFinite(since)) return { endMs: nowMs, seconds: 0, anomaly: true };
  const anomaly = nowMs < since;
  const raw = Math.max(0, (nowMs - since) / 1000);
  const seconds = Math.min(raw, remaining);
  return { endMs: since + seconds * 1000, seconds, anomaly };
}

export function startSession(session: FlightSession, nowMs: number, segmentId: UUID): TransitionResult {
  if (session.status === "active") return { session, segments: {}, noop: true };
  if (session.status !== "boarding") throw new TransitionError(`cannot start from ${session.status}`);
  const now = iso(nowMs);
  return {
    session: { ...session, status: "active", startedAt: now, activeSince: now, pausedAt: null, updatedAt: now },
    segments: { open: { id: segmentId, sessionId: session.id, startedAt: now, endedAt: null, durationSeconds: 0 } },
  };
}

export function pauseSession(session: FlightSession, nowMs: number): TransitionResult {
  if (session.status === "paused") return { session, segments: {}, noop: true };
  if (session.status !== "active") throw new TransitionError(`cannot pause from ${session.status}`);
  const run = closeRun(session, nowMs);
  const now = iso(nowMs);
  return {
    session: {
      ...session,
      status: "paused",
      accumulatedFocusSeconds: round3(session.accumulatedFocusSeconds + run.seconds),
      activeSince: null,
      pausedAt: now,
      clockAnomaly: session.clockAnomaly || run.anomaly,
      updatedAt: now,
    },
    segments: { close: { endedAt: iso(run.endMs), durationSeconds: round3(run.seconds) } },
  };
}

export function resumeSession(session: FlightSession, nowMs: number, segmentId: UUID): TransitionResult {
  if (session.status === "active") return { session, segments: {}, noop: true };
  if (session.status !== "paused") throw new TransitionError(`cannot resume from ${session.status}`);
  const now = iso(nowMs);
  return {
    session: { ...session, status: "active", activeSince: now, pausedAt: null, updatedAt: now },
    segments: { open: { id: segmentId, sessionId: session.id, startedAt: now, endedAt: null, durationSeconds: 0 } },
  };
}

function finalize(
  session: FlightSession,
  nowMs: number,
  outcome: { kind: "completed"; type: CompletionType } | { kind: "abandoned"; reason: string },
): TransitionResult {
  let accumulated = session.accumulatedFocusSeconds;
  let endMs = nowMs;
  let anomaly = !!session.clockAnomaly;
  const segments: SegmentOps = {};
  if (session.status === "active") {
    const run = closeRun(session, nowMs);
    accumulated = round3(accumulated + run.seconds);
    anomaly = anomaly || run.anomaly;
    segments.close = { endedAt: iso(run.endMs), durationSeconds: round3(run.seconds) };
    // 予定時刻に到達していた場合、着陸時刻は終了予定時刻とする（タブを閉じていた場合も同じ）
    if (outcome.kind === "completed" && outcome.type === "on_time") endMs = run.endMs;
  }
  const now = iso(nowMs);
  const focus = Math.min(session.plannedSeconds, accumulated);
  if (outcome.kind === "abandoned") {
    return {
      session: {
        ...session,
        status: "abandoned",
        accumulatedFocusSeconds: focus,
        activeSince: null,
        pausedAt: null,
        completedAt: iso(endMs),
        actualFocusSeconds: Math.floor(focus),
        completionType: null,
        abandonmentReason: outcome.reason,
        earnedSkyPoints: 0,
        clockAnomaly: anomaly,
        updatedAt: now,
      },
      segments,
    };
  }
  const actual = Math.floor(focus + 1e-6);
  const completed: FlightSession = {
    ...session,
    status: "completed",
    accumulatedFocusSeconds: focus,
    activeSince: null,
    pausedAt: null,
    completedAt: iso(endMs),
    actualFocusSeconds: actual,
    completionType: outcome.type,
    clockAnomaly: anomaly,
    updatedAt: now,
  };
  completed.earnedSkyPoints = computeSkyPoints(completed);
  return { session: completed, segments };
}

/**
 * 予定時間到達による着陸。到達していなければ例外。
 * 既に completed なら何もしない（多重着陸・リロード・2タブ同時でもポイントは一度だけ）。
 */
export function completeOnTime(session: FlightSession, nowMs: number): TransitionResult {
  if (session.status === "completed") return { session, segments: {}, noop: true };
  if (!isOpen(session)) throw new TransitionError(`cannot complete from ${session.status}`);
  if (elapsedSeconds(session, nowMs) < session.plannedSeconds) throw new TransitionError("not due yet");
  return finalize(session, nowMs, { kind: "completed", type: "on_time" });
}

/**
 * 早期着陸。最小時間以上なら completed(early)、未満なら abandoned。
 * 予定時間に到達済みなら on_time 扱い。
 */
export function landEarly(session: FlightSession, nowMs: number, minSeconds = DEFAULT_EARLY_LANDING_MIN_SECONDS): TransitionResult {
  if (session.status === "completed" || session.status === "abandoned") return { session, segments: {}, noop: true };
  if (!isOpen(session)) throw new TransitionError(`cannot land from ${session.status}`);
  const elapsed = elapsedSeconds(session, nowMs);
  if (elapsed >= session.plannedSeconds) return finalize(session, nowMs, { kind: "completed", type: "on_time" });
  if (elapsed >= minSeconds) return finalize(session, nowMs, { kind: "completed", type: "early" });
  return finalize(session, nowMs, { kind: "abandoned", reason: "early_landing_below_minimum" });
}

export function abandonSession(session: FlightSession, nowMs: number, reason = "user_abandoned"): TransitionResult {
  if (session.status === "abandoned" || session.status === "completed") return { session, segments: {}, noop: true };
  if (session.status === "boarding") {
    const now = iso(nowMs);
    return { session: { ...session, status: "abandoned", abandonmentReason: reason, completedAt: now, actualFocusSeconds: 0, updatedAt: now }, segments: {} };
  }
  return finalize(session, nowMs, { kind: "abandoned", reason });
}

/** 早期着陸した場合の結果の種類（確認ダイアログの文言用）。 */
export function earlyLandingOutcome(session: FlightSession, nowMs: number, minSeconds = DEFAULT_EARLY_LANDING_MIN_SECONDS): "on_time" | "early" | "abandoned" {
  const elapsed = elapsedSeconds(session, nowMs);
  if (elapsed >= session.plannedSeconds) return "on_time";
  return elapsed >= minSeconds ? "early" : "abandoned";
}

export function validatePlannedMinutes(minutes: number): string | null {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return "分を整数で入力してください";
  if (minutes < MIN_PLANNED_MINUTES) return `${MIN_PLANNED_MINUTES}分以上を指定してください`;
  if (minutes > MAX_PLANNED_MINUTES) return `${MAX_PLANNED_MINUTES}分以下を指定してください`;
  return null;
}
