// フライトセッションの永続化。状態遷移は domain/session の純粋関数を
// Dexie トランザクション内で「最新レコードを読み直してから」適用するので、
// 着陸ボタン連打・リロード・2タブ同時操作でも冪等になる。

import { airportCodeOf as airportCode } from "@/domain/airport-search";
import { estimatedBlockMinutes } from "@/domain/flight-time";
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
import type { Airport, FlightLeg, FlightSession, Subject } from "@/domain/types";
import { newId } from "@/lib/id";
import { getDb, type StudyFlightDB } from "./db";
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
  /** 今回の学習時間（分）。区間の残りより長ければ区間の残りで終わる */
  plannedMinutes: number;
  seat?: string;
  /** 新しい区間（resumeLegId がないとき必須） */
  origin?: Airport;
  destination?: Airport;
  routeSource?: FlightLeg["routeSource"];
  carriers?: string[];
  tripId?: string | null;
  /** 途中で止まっている区間の続きを飛ぶ */
  resumeLegId?: string;
}

/**
 * 搭乗券を発行（status=boarding）。未出発の古い搭乗券は置き換える。
 * 新しい区間を作るか、途中の区間を再開する。セッションの予定時間は min(学習時間, 区間の残り)。
 */
export async function issueBoardingPass(input: BoardingInput): Promise<FlightSession> {
  const err = validatePlannedMinutes(input.plannedMinutes);
  if (err) throw new Error(err);
  if (!input.resumeLegId) {
    if (!input.origin || !input.destination) throw new Error("出発地と到着地を選んでください");
    if (input.origin.id === input.destination.id) throw new Error("出発地と到着地は別の空港を選んでください");
  }
  const db = getDb();
  return db.transaction("rw", db.sessions, db.legs, async () => {
    const open = await db.sessions.where("status").anyOf("active", "paused").first();
    if (open) throw new OpenFlightExistsError(open.id);
    // 未出発の搭乗券を取り消す（その搭乗券のために作った未飛行の区間も取り消す）
    for (const b of await db.sessions.where("status").equals("boarding").toArray()) {
      await db.sessions.delete(b.id);
      if (b.legId && b.legId !== input.resumeLegId) await cancelLegIfUnflown(db, b.legId);
    }
    const t = new Date().toISOString();
    let leg: FlightLeg;
    if (input.resumeLegId) {
      const found = await db.legs.get(input.resumeLegId);
      if (!found || found.status !== "in_progress") throw new Error("再開できるフライトが見つかりません");
      leg = found;
    } else {
      const o = input.origin!;
      const d = input.destination!;
      const km = Math.round(haversineKm([o.lng, o.lat], [d.lng, d.lat]) * 10) / 10;
      // 進行中の別の区間がある場合は、その区間を取り消してから新しい区間を始める
      for (const other of await db.legs.where("status").equals("in_progress").toArray()) await db.legs.update(other.id, { status: "cancelled", updatedAt: t });
      leg = {
        id: newId(),
        tripId: input.tripId ?? null,
        originAirportId: o.id,
        destinationAirportId: d.id,
        originCode: airportCode(o),
        destinationCode: airportCode(d),
        routeSource: input.routeSource ?? "estimated",
        carriers: input.carriers ?? [],
        distanceKm: km,
        scheduledSeconds: estimatedBlockMinutes(km) * 60,
        flownSeconds: 0,
        status: "in_progress",
        createdAt: t,
        updatedAt: t,
        arrivedAt: null,
      };
      await db.legs.add(leg);
    }
    const remaining = Math.max(1, leg.scheduledSeconds - leg.flownSeconds);
    const session: FlightSession = {
      id: newId(),
      status: "boarding",
      subjectId: input.subject.id,
      subjectName: input.subject.name,
      subjectColor: input.subject.color,
      taskId: input.task?.id ?? null,
      taskTitle: input.task?.title ?? null,
      originAirportId: leg.originAirportId,
      destinationAirportId: leg.destinationAirportId,
      originCode: leg.originCode,
      destinationCode: leg.destinationCode,
      seat: input.seat ?? randomSeat(),
      plannedSeconds: Math.min(input.plannedMinutes * 60, remaining),
      startedAt: null,
      activeSince: null,
      accumulatedFocusSeconds: 0,
      pausedAt: null,
      completedAt: null,
      actualFocusSeconds: null,
      completionType: null,
      abandonmentReason: null,
      legId: leg.id,
      legStartSeconds: leg.flownSeconds,
      legScheduledSeconds: leg.scheduledSeconds,
      routeDistanceKm: leg.distanceKm,
      distanceKm: leg.distanceKm,
      earnedSkyPoints: 0,
      note: "",
      createdAt: t,
      updatedAt: t,
    };
    await db.sessions.add(session);
    return session;
  });
}

async function cancelLegIfUnflown(db: StudyFlightDB, legId: string): Promise<void> {
  const leg = await db.legs.get(legId);
  if (leg && leg.status === "in_progress" && leg.flownSeconds <= 0) await db.legs.update(legId, { status: "cancelled", updatedAt: new Date().toISOString() });
}

/**
 * 区間の飛行済み時間を、完了したセッションの集中時間の合計から計算し直す（原本からの再計算）。
 * 予定時間に達したら到着、旅行の最終目的地なら旅行も完了にする。
 */
async function recomputeLeg(db: StudyFlightDB, legId: string): Promise<void> {
  const leg = await db.legs.get(legId);
  if (!leg) return;
  const done = (await db.sessions.where("status").equals("completed").toArray())
    .filter((s) => s.legId === legId)
    .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  let flown = 0;
  let arrivedAt: string | null = null;
  for (const s of done) {
    flown += s.actualFocusSeconds ?? 0;
    if (!arrivedAt && flown >= leg.scheduledSeconds - 0.5) arrivedAt = s.completedAt ?? new Date().toISOString();
  }
  flown = Math.min(leg.scheduledSeconds, flown);
  const t = new Date().toISOString();
  const status: FlightLeg["status"] = arrivedAt ? "arrived" : leg.status === "arrived" ? "in_progress" : leg.status;
  await db.legs.put({ ...leg, flownSeconds: flown, status, arrivedAt, updatedAt: t });
  if (arrivedAt && leg.tripId) {
    const trip = await db.trips.get(leg.tripId);
    if (trip && trip.status === "active" && trip.finalDestinationId === leg.destinationAirportId) {
      await db.trips.put({ ...trip, status: "completed", completedAt: arrivedAt, updatedAt: t });
    }
  }
}

type Transition = (session: FlightSession, nowMs: number) => TransitionResult;

async function applyTransition(id: string, fn: Transition, nowMs: () => number = Date.now): Promise<FlightSession> {
  return withLock(`session:${id}`, async () => {
    const db = getDb();
    return db.transaction("rw", [db.sessions, db.focusSegments, db.legs, db.trips], async () => {
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
      // 終了したら区間の進み具合を同じトランザクションで更新する
      const ended = result.session.status === "completed" || result.session.status === "abandoned";
      if (ended && result.session.legId) {
        await recomputeLeg(db, result.session.legId);
        if (result.session.status === "abandoned") await cancelLegIfUnflown(db, result.session.legId);
      }
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

/**
 * 早期着陸。区間の途中なら機体はその地点で止まり、次回同じ地点から再開できる。
 * 集中した時間が短すぎる場合（既定5分未満）は欠航扱いで、区間は進まない。
 */
export async function landFlightEarly(id: string, nowMs?: () => number): Promise<FlightSession> {
  const { earlyLandingMinSeconds } = await getPreferences();
  return applyTransition(id, (s, now) => landEarly(s, now, earlyLandingMinSeconds), nowMs);
}

/** 途中の区間をあきらめる（機体は出発空港に戻った扱い。飛んだ時間の学習記録はそのまま残る）。 */
export async function cancelLeg(legId: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.legs, db.sessions, async () => {
    const open = await db.sessions.where("status").anyOf("active", "paused", "boarding").filter((s) => s.legId === legId).first();
    if (open) throw new Error("この区間のフライトが進行中です");
    await db.legs.update(legId, { status: "cancelled", updatedAt: new Date().toISOString() });
  });
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
  await db.transaction("rw", [db.sessions, db.focusSegments, db.legs, db.trips], async () => {
    const s = await db.sessions.get(id);
    await db.focusSegments.where("sessionId").equals(id).delete();
    await db.sessions.delete(id);
    if (s?.legId) await recomputeLeg(db, s.legId);
  });
}
