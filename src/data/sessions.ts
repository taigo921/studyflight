// フライトセッションの永続化。状態遷移は domain/session の純粋関数を
// Dexie トランザクション内で「最新レコードを読み直してから」適用するので、
// 着陸ボタン連打・リロード・2タブ同時操作でも冪等になる。

import { airportCodeOf as airportCode } from "@/domain/airport-search";
import { haversineKm } from "@/domain/geo";
import {
  abandonSession,
  completeOnTime,
  elapsedSeconds,
  isDue,
  isOpen,
  landEarly,
  pauseSession,
  resumeSession,
  startSession,
  TransitionError,
  validatePlannedMinutes,
  type TransitionResult,
} from "@/domain/session";
import type { Airport, FlightSession, Subject } from "@/domain/types";
import { newId } from "@/lib/id";
import { getDb } from "./db";
import { getPreferences } from "./settings";

export class OpenFlightExistsError extends Error {
  constructor(public readonly sessionId: string) {
    super("進行中のフライトがあります。先に着陸または破棄してください。");
    this.name = "OpenFlightExistsError";
  }
}

/** Web Locks API があれば同一セッションへの操作をタブ間で直列化する。 */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return locks.request(`studyflight:${name}`, fn) as Promise<T>;
  return fn();
}

export function randomSeat(): string {
  const row = 3 + Math.floor(Math.random() * 38);
  const letter = "ACDHJK"[Math.floor(Math.random() * 6)];
  return `${row}${letter}`;
}

export interface BoardingInput {
  subject: Pick<Subject, "id" | "name" | "color">;
  task?: { id: string; title: string } | null;
  origin: Airport;
  destination: Airport;
  plannedMinutes: number;
  seat?: string;
}

/** 搭乗券を発行（status=boarding）。未出発の古い搭乗券は置き換える。 */
export async function issueBoardingPass(input: BoardingInput): Promise<FlightSession> {
  const err = validatePlannedMinutes(input.plannedMinutes);
  if (err) throw new Error(err);
  if (input.origin.id === input.destination.id) throw new Error("出発地と到着地は別の空港を選んでください");
  const db = getDb();
  return db.transaction("rw", db.sessions, async () => {
    const open = await db.sessions.where("status").anyOf("active", "paused").first();
    if (open) throw new OpenFlightExistsError(open.id);
    await db.sessions.where("status").equals("boarding").delete();
    const t = new Date().toISOString();
    const session: FlightSession = {
      id: newId(),
      status: "boarding",
      subjectId: input.subject.id,
      subjectName: input.subject.name,
      subjectColor: input.subject.color,
      taskId: input.task?.id ?? null,
      taskTitle: input.task?.title ?? null,
      originAirportId: input.origin.id,
      destinationAirportId: input.destination.id,
      originCode: airportCode(input.origin),
      destinationCode: airportCode(input.destination),
      seat: input.seat ?? randomSeat(),
      plannedSeconds: input.plannedMinutes * 60,
      startedAt: null,
      activeSince: null,
      accumulatedFocusSeconds: 0,
      pausedAt: null,
      completedAt: null,
      actualFocusSeconds: null,
      completionType: null,
      abandonmentReason: null,
      distanceKm: Math.round(haversineKm([input.origin.lng, input.origin.lat], [input.destination.lng, input.destination.lat]) * 10) / 10,
      earnedSkyPoints: 0,
      note: "",
      createdAt: t,
      updatedAt: t,
    };
    await db.sessions.add(session);
    return session;
  });
}

type Transition = (session: FlightSession, nowMs: number) => TransitionResult;

async function applyTransition(id: string, fn: Transition, nowMs: () => number = Date.now): Promise<FlightSession> {
  return withLock(`session:${id}`, async () => {
    const db = getDb();
    return db.transaction("rw", db.sessions, db.focusSegments, async () => {
      const current = await db.sessions.get(id);
      if (!current) throw new TransitionError("session not found");
      const result = fn(current, nowMs());
      if (result.noop) return current;
      const { close, open } = result.segments;
      if (close) {
        const openSegs = await db.focusSegments.where("sessionId").equals(id).filter((s) => s.endedAt === null).toArray();
        for (const seg of openSegs) await db.focusSegments.update(seg.id, { endedAt: close.endedAt, durationSeconds: close.durationSeconds });
      }
      if (open) await db.focusSegments.add(open);
      await db.sessions.put(result.session);
      return result.session;
    });
  });
}

export async function departFlight(id: string, nowMs?: () => number): Promise<FlightSession> {
  const db = getDb();
  const other = await db.sessions.where("status").anyOf("active", "paused").first();
  if (other && other.id !== id) throw new OpenFlightExistsError(other.id);
  return applyTransition(id, (s, now) => startSession(s, now, newId()), nowMs);
}

export const pauseFlight = (id: string, nowMs?: () => number) => applyTransition(id, pauseSession, nowMs);
export const resumeFlight = (id: string, nowMs?: () => number) => applyTransition(id, (s, now) => resumeSession(s, now, newId()), nowMs);
export const abandonFlight = (id: string, reason?: string, nowMs?: () => number) => applyTransition(id, (s, now) => abandonSession(s, now, reason), nowMs);

export async function landFlightEarly(id: string, nowMs?: () => number): Promise<FlightSession> {
  const { earlyLandingMinSeconds } = await getPreferences();
  return applyTransition(id, (s, now) => landEarly(s, now, earlyLandingMinSeconds), nowMs);
}

/** 予定時間に到達していれば完了を確定する。未到達なら現状を返す。何度呼んでも安全。 */
export async function completeIfDue(id: string, nowMs: () => number = Date.now): Promise<FlightSession | null> {
  return applyTransition(
    id,
    (s, now) => {
      const due = isOpen(s) && elapsedSeconds(s, now) >= s.plannedSeconds;
      if (!due) return { session: s, segments: {}, noop: true };
      return completeOnTime(s, now);
    },
    nowMs,
  ).catch((e) => {
    if (e instanceof TransitionError) return null;
    throw e;
  });
}

/** 起動時: タブを閉じている間に予定時刻を過ぎたフライトの着陸を確定する。 */
export async function resolveDueFlights(nowMs: () => number = Date.now): Promise<FlightSession[]> {
  const open = await getDb().sessions.where("status").equals("active").toArray();
  const landed: FlightSession[] = [];
  for (const s of open) {
    if (!isDue(s, nowMs())) continue;
    const r = await completeIfDue(s.id, nowMs);
    if (r?.status === "completed") landed.push(r);
  }
  return landed;
}

export async function getOpenFlight(): Promise<FlightSession | undefined> {
  return getDb().sessions.where("status").anyOf("active", "paused").first();
}

export async function saveNote(id: string, note: string): Promise<void> {
  await getDb().sessions.update(id, { note: note.slice(0, 1000), updatedAt: new Date().toISOString() });
}

/** 記録の修正（科目の付け替え・メモ）。集中時間・ポイントは変更しない。 */
export async function correctSession(id: string, patch: { subject?: Pick<Subject, "id" | "name" | "color">; note?: string }): Promise<void> {
  const update: Partial<FlightSession> = { updatedAt: new Date().toISOString() };
  if (patch.subject) Object.assign(update, { subjectId: patch.subject.id, subjectName: patch.subject.name, subjectColor: patch.subject.color });
  if (patch.note !== undefined) update.note = patch.note.slice(0, 1000);
  await getDb().sessions.update(id, update);
}

export async function deleteSession(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.sessions, db.focusSegments, async () => {
    await db.focusSegments.where("sessionId").equals(id).delete();
    await db.sessions.delete(id);
  });
}
