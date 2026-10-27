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

describe("区間を分割して飛ぶ", () => {
  it("学習時間 < 予定飛行時間なら上空で止まり、次回同じ地点から再開して到着", async () => {
    const subject = await createSubject("生理学");
    expect(blockHndCts).toBeGreaterThan(60);
    const first = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 60, routeSource: "route", carriers: ["JL"] }, 60);
    expect(first.plannedSeconds).toBe(3600);
    const r1 = await completeIfDue(first.id, now);
    expect(r1?.status).toBe("completed");
    expect(r1?.reachedDestination).toBe(false);
    const leg = (await db.legs.toArray())[0];
    expect(leg.status).toBe("in_progress");
    expect(leg.flownSeconds).toBe(3600);
    expect(leg.routeSource).toBe("route");
    const st = travelState(await db.sessions.toArray(), await db.legs.toArray(), null);
    expect(st.kind).toBe("air");

    // 続き: 区間の残りが学習時間より短ければ、残りの時間で着陸
    const second = await issueBoardingPass({ subject, plannedMinutes: 90, resumeLegId: leg.id });
    expect(second.legStartSeconds).toBe(3600);
    expect(second.plannedSeconds).toBe(blockHndCts * 60 - 3600);
    await departFlight(second.id, now);
    min(blockHndCts);
    const r2 = await completeIfDue(second.id, now);
    expect(r2?.reachedDestination).toBe(true);
    const arrived = await db.legs.get(leg.id);
    expect(arrived?.status).toBe("arrived");
    expect(travelState(await db.sessions.toArray(), await db.legs.toArray(), null)).toEqual({ kind: "ground", airportId: "RJCC" });
    // 進んだ距離の合計は区間の距離と一致
    const total = (await db.sessions.toArray()).reduce((a, s) => a + s.distanceKm, 0);
    expect(total).toBeCloseTo(leg.distanceKm, 0);
  });

  it("早期着陸（5分以上）は上空で停止、5分未満は欠航で区間は進まず取り消し", async () => {
    const subject = await createSubject("生化学");
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 60 }, 12);
    const r = await landFlightEarly(s.id, now);
    expect(r.completionType).toBe("early");
    expect(r.reachedDestination).toBe(false);
    expect(r.landedAirportId ?? null).toBeNull(); // ダイバートしない
    expect((await db.legs.toArray())[0].flownSeconds).toBe(720);

    const s2 = await fly({ subject, origin: HND, destination: OKA, plannedMinutes: 60 }, 2);
    expect((await db.legs.where("status").equals("cancelled").count())).toBe(1); // 前の区間は新しい区間で取り消し
    await landFlightEarly(s2.id, now);
    const okaLeg = (await db.legs.toArray()).find((l) => l.destinationAirportId === "ROAH")!;
    expect(okaLeg.status).toBe("cancelled");
    expect(okaLeg.flownSeconds).toBe(0);
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

  it("途中の区間をあきらめると出発空港に戻る", async () => {
    const subject = await createSubject("数学");
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 30 }, 30);
    await completeIfDue(s.id, now);
    const leg = (await db.legs.toArray())[0];
    await cancelLeg(leg.id);
    expect(travelState(await db.sessions.toArray(), await db.legs.toArray(), null)).toEqual({ kind: "ground", airportId: "RJTT" });
  });
});

describe("旅行計画", () => {
  it("最終目的地に到着すると旅行が完了する", async () => {
    const subject = await createSubject("英語");
    const trip = await setFinalDestination(HND.id, CTS.id);
    const s = await fly({ subject, origin: HND, destination: CTS, plannedMinutes: 240, tripId: trip.id }, blockHndCts);
    await completeIfDue(s.id, now);
    expect((await db.trips.get(trip.id))?.status).toBe("completed");
  });
});
