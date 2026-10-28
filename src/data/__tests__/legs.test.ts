import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CORE_AIRPORTS } from "../core-airports";
import { setDbForTesting, StudyFlightDB } from "../db";
import { abandonFlight, cancelLeg, completeIfDue, deleteSession, departFlight, issueBoardingPass, landFlightEarly } from "../sessions";
import { createSubject } from "../subjects";
import { setFinalDestination } from "../trips";
import { estimatedBlockMinutes } from "@/domain/flight-time";
import { haversineKm } from "@/domain/geo";
import { travelState } from "@/domain/route-planner";

const A = (id: string) => CORE_AIRPORTS.find((a) => a.id === id)!;
const HND = A("RJTT");
const CTS = A("RJCC");
const OKA = A("ROAH");
const T0 = Date.parse("2026-10-27T01:00:00Z");
let clock = T0;
const now = () => clock;
const min = (m: number) => (clock += m * 60_000);

let n = 0;
let db: StudyFlightDB;
beforeEach(() => {
  clock = T0;
  db = new StudyFlightDB(`legs-${++n}`);
  setDbForTesting(db);
});
afterEach(() => {
  db.close();
  setDbForTesting(null);
});

const blockHndCts = estimatedBlockMinutes(haversineKm([HND.lng, HND.lat], [CTS.lng, CTS.lat]));

async function fly(input: Parameters<typeof issueBoardingPass>[0], minutes: number) {
  const s = await issueBoardingPass(input);
  await departFlight(s.id, now);
  min(minutes);
  return s;
}

describe("飛行時間 = 学習時間（途中で止まらない）", () => {
  it("学習時間ちょうどで目的地に着く。推定飛行時間が長くても上空で止まらない", async () => {
    const subject = await createSubject("生理学");
    expect(blockHndCts).toBeGreaterThan(60);
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 60, routeSource: "route", carriers: ["JL"] }, 60);
    expect(s.plannedSeconds).toBe(3600);
    expect(s.legScheduledSeconds).toBe(3600);
    const r = await completeIfDue(s.id, now);
    expect(r?.reachedDestination).toBe(true);
    expect(r?.distanceKm).toBeCloseTo(s.routeDistanceKm!, 0);
    const leg = (await db.legs.toArray())[0];
    expect(leg.status).toBe("arrived");
    expect(leg.routeSource).toBe("route");
    expect(travelState(await db.sessions.toArray(), await db.legs.toArray(), null)).toEqual({ kind: "ground", airportId: "RJCC" });
  });

  it("早期着陸は最寄り空港にダイバート、90%以上なら目的地、5分未満は欠航", async () => {
    const subject = await createSubject("生化学");
    const s = await fly({ subject, origin: HND, destination: OKA, plannedMinutes: 60 }, 20);
    const r = await landFlightEarly(s.id, now, { id: "RJNS", code: "FSZ" });
    expect(r.completionType).toBe("early");
    expect(r.reachedDestination).toBe(true);
    expect(r.landedAirportId).toBe("RJNS");
    const leg = (await db.legs.toArray())[0];
    expect(leg.status).toBe("arrived");
    expect(leg.destinationAirportId).toBe("RJNS");
    expect(travelState(await db.sessions.toArray(), await db.legs.toArray(), null)).toEqual({ kind: "ground", airportId: "RJNS" });

    const s2 = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 30 }, 28);
    const r2 = await landFlightEarly(s2.id, now, { id: "RJSS", code: "SDJ" });
    expect(r2.landedAirportId ?? null).toBeNull(); // 93% 進んでいるので目的地に着く
    expect(r2.reachedDestination).toBe(true);

    const s3 = await fly({ subject, origin: CTS, destination: HND, plannedMinutes: 60 }, 2);
    await landFlightEarly(s3.id, now, { id: "RJCC", code: "CTS" });
    const cancelled = (await db.legs.toArray()).find((l) => l.originAirportId === "RJCC")!;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.flownSeconds).toBe(0);
  });

  it("搭乗券の取り消し・放棄では区間が進まない", async () => {
    const subject = await createSubject("微生物学");
    const s = await issueBoardingPass({ subject, origin: HND, destination: CTS, plannedMinutes: 30 });
    await abandonFlight(s.id, "boarding_cancelled", now);
    expect((await db.legs.toArray())[0].status).toBe("cancelled");
  });

  it("記録を削除すると区間の進捗を原本から再計算する", async () => {
    const subject = await createSubject("その他");
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 30 }, 30);
    await completeIfDue(s.id, now);
    expect((await db.legs.toArray())[0].flownSeconds).toBe(1800);
    await deleteSession(s.id);
    expect((await db.legs.toArray())[0].flownSeconds).toBe(0);
  });

  it("以前の途中停止の区間が残っていても、新しい搭乗券の発行で取り消される", async () => {
    const subject = await createSubject("数学");
    const t = new Date(clock).toISOString();
    await db.legs.add({ id: "old", tripId: null, originAirportId: "RJTT", destinationAirportId: "ROAH", originCode: "HND", destinationCode: "OKA", routeSource: "route", carriers: [], distanceKm: 1555, scheduledSeconds: 9600, flownSeconds: 1800, status: "in_progress", createdAt: t, updatedAt: t, arrivedAt: null });
    expect(travelState(await db.sessions.toArray(), await db.legs.toArray(), null).kind).toBe("air");
    await issueBoardingPass({ subject, origin: HND, destination: CTS, plannedMinutes: 60 });
    expect((await db.legs.get("old"))?.status).toBe("cancelled");
    await cancelLeg((await db.legs.toArray()).find((l) => l.id !== "old")!.id).catch(() => {}); // 搭乗券がある間は取り消せない
  });
});

describe("旅行計画", () => {
  it("最終目的地に到着すると旅行が完了する", async () => {
    const subject = await createSubject("英語");
    const trip = await setFinalDestination(HND.id, CTS.id);
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 100, tripId: trip.id }, 100);
    await completeIfDue(s.id, now);
    expect((await db.trips.get(trip.id))?.status).toBe("completed");
  });
});
