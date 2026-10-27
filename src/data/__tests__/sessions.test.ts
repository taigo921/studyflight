import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CORE_AIRPORTS } from "../core-airports";
import { setDbForTesting, StudyFlightDB } from "../db";
import {
  abandonFlight,
  completeIfDue,
  departFlight,
  issueBoardingPass,
  landFlightEarly,
  OpenFlightExistsError,
  pauseFlight,
  resolveDueFlights,
  resumeFlight,
} from "../sessions";
import { createSubject } from "../subjects";
import { applyImport, exportBackup, parseBackup, previewImport, sessionsToCsv, ImportValidationError } from "../backup";

const NKM = CORE_AIRPORTS.find((a) => a.id === "RJNA")!;
const HND = CORE_AIRPORTS.find((a) => a.id === "RJTT")!;
const T0 = Date.parse("2026-10-27T01:00:00Z");
const at = (minutes: number) => () => T0 + minutes * 60_000;

let n = 0;
let db: StudyFlightDB;
beforeEach(() => {
  db = new StudyFlightDB(`test-${++n}`);
  setDbForTesting(db);
});
afterEach(async () => {
  db.close();
  setDbForTesting(null);
});

async function boarded(minutes = 25) {
  const subject = await createSubject("生理学");
  return issueBoardingPass({ subject, origin: NKM, destination: HND, plannedMinutes: minutes, seat: "12A" });
}

describe("フライト永続化", () => {
  it("搭乗券発行→出発→一時停止→再開→完了の一連の流れ", async () => {
    const s = await boarded();
    expect(s.status).toBe("boarding");
    expect(s.originCode).toBe("NKM");
    expect(s.distanceKm).toBeGreaterThan(200);

    await departFlight(s.id, at(0));
    await pauseFlight(s.id, at(10));
    const paused = await db.sessions.get(s.id);
    expect(paused?.accumulatedFocusSeconds).toBe(600);

    // 一時停止中に放置
    expect(await completeIfDue(s.id, at(40))).toMatchObject({ status: "paused" });

    await resumeFlight(s.id, at(40));
    const done = await completeIfDue(s.id, at(60));
    expect(done?.status).toBe("completed");
    expect(done?.actualFocusSeconds).toBe(1500);
    expect(done?.earnedSkyPoints).toBe(35);
    expect(done?.completedAt).toBe(new Date(T0 + 55 * 60_000).toISOString());

    const segs = await db.focusSegments.where("sessionId").equals(s.id).sortBy("startedAt");
    expect(segs).toHaveLength(2);
    expect(segs.map((x) => x.durationSeconds)).toEqual([600, 900]);
    expect(segs.every((x) => x.endedAt !== null)).toBe(true);
  });

  it("同時に何度も完了処理してもレコード・ポイントは1回分", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    const results = await Promise.all([completeIfDue(s.id, at(25)), completeIfDue(s.id, at(26)), landFlightEarly(s.id, at(27)), completeIfDue(s.id, at(30))]);
    expect(results.every((r) => r?.status === "completed")).toBe(true);
    const all = await db.sessions.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].earnedSkyPoints).toBe(35);
    expect(all[0].completedAt).toBe(new Date(T0 + 25 * 60_000).toISOString());
    expect(await db.focusSegments.count()).toBe(1);
  });

  it("リロード（DB を開き直し）後も進行状態が復元される", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    const name = db.name;
    db.close();
    db = new StudyFlightDB(name);
    setDbForTesting(db);
    const restored = await db.sessions.get(s.id);
    const { elapsedSeconds } = await import("@/domain/session");
    expect(elapsedSeconds(restored!, at(10)())).toBe(600);
  });

  it("タブを閉じている間に予定時刻を過ぎたら次回起動で着陸を確定", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    expect(await resolveDueFlights(at(20))).toHaveLength(0);
    const landed = await resolveDueFlights(at(300));
    expect(landed).toHaveLength(1);
    expect(landed[0].completedAt).toBe(new Date(T0 + 25 * 60_000).toISOString());
    expect(await resolveDueFlights(at(301))).toHaveLength(0);
  });

  it("進行中フライトは最大1件", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    await expect(boarded()).rejects.toBeInstanceOf(OpenFlightExistsError);
  });

  it("未出発の搭乗券は新しい搭乗券で置き換わる", async () => {
    await boarded();
    await boarded();
    expect(await db.sessions.where("status").equals("boarding").count()).toBe(1);
  });

  it("早期着陸: 5分未満は放棄、以上は early", async () => {
    const a = await boarded();
    await departFlight(a.id, at(0));
    expect((await landFlightEarly(a.id, at(3))).status).toBe("abandoned");
    const b = await boarded();
    await departFlight(b.id, at(10));
    const r = await landFlightEarly(b.id, at(22));
    expect(r.status).toBe("completed");
    expect(r.completionType).toBe("early");
    expect(r.earnedSkyPoints).toBe(12);
  });

  it("放棄は記録されるがポイント0", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    const r = await abandonFlight(s.id, "user_abandoned", at(15));
    expect(r.status).toBe("abandoned");
    expect(r.earnedSkyPoints).toBe(0);
  });

  it("同一空港・範囲外の時間は拒否", async () => {
    const subject = await createSubject("数学");
    await expect(issueBoardingPass({ subject, origin: NKM, destination: NKM, plannedMinutes: 25 })).rejects.toThrow();
    await expect(issueBoardingPass({ subject, origin: NKM, destination: HND, plannedMinutes: 3 })).rejects.toThrow();
  });
});

describe("バックアップ", () => {
  it("エクスポート→新規環境にインポートで復元", async () => {
    const s = await boarded();
    await departFlight(s.id, at(0));
    await completeIfDue(s.id, at(25));
    const backup = await exportBackup();
    const text = JSON.stringify(backup);

    db.close();
    db = new StudyFlightDB(`test-restore-${n}`);
    setDbForTesting(db);
    const preview = await previewImport(text);
    expect(preview.counts.sessions).toBe(1);
    expect(preview.conflicts.sessions).toBe(0);
    await applyImport(preview.backup, "merge");
    expect(await db.subjects.count()).toBe(1);
    const restored = await db.sessions.get(s.id);
    expect(restored?.earnedSkyPoints).toBe(35);
    expect(await db.focusSegments.count()).toBe(1);

    // 二重インポートしても増えない
    await applyImport(parseBackup(text), "merge");
    expect(await db.sessions.count()).toBe(1);
    expect(await db.focusSegments.count()).toBe(1);
  });

  it("破損データ・重複 ID を拒否", async () => {
    expect(() => parseBackup("{not json")).toThrow(ImportValidationError);
    expect(() => parseBackup(JSON.stringify({ app: "other" }))).toThrow(ImportValidationError);
    const s = await boarded();
    const b = await exportBackup();
    b.data.subjects.push({ ...b.data.subjects[0] });
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/重複/);
    void s;
  });

  it("CSV はエスケープ・数式インジェクション対策", async () => {
    const s = await boarded();
    const csv = sessionsToCsv([{ ...s, note: '=HYPERLINK("x"), "quoted"' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x""), ""quoted"""`);
  });
});
