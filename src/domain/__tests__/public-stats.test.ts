import { describe, expect, it } from "vitest";
import { buildPublicStats, PUBLIC_RECENT } from "../public-stats";
import type { FlightSession } from "../types";
import { makeSession } from "./fixtures";

const now = Date.parse("2026-10-29T03:00:00Z");
const done = (id: string, minutes: number, at: string, o: Partial<FlightSession> = {}) =>
  makeSession({ id, status: "completed", actualFocusSeconds: minutes * 60, plannedSeconds: minutes * 60, completedAt: at, note: "秘密のメモ", taskTitle: "問題集 p.10", ...o });

describe("buildPublicStats", () => {
  const sessions = [
    done("a", 30, "2026-10-29T01:00:00Z", { subjectName: "口腔生理学", originCode: "NGO", destinationCode: "HND" }),
    done("b", 60, "2026-10-28T01:00:00Z", { originCode: "HND", destinationCode: "OKA", landedAirportId: "RJNS", landedCode: "FSZ" }),
    makeSession({ id: "c", status: "abandoned", actualFocusSeconds: 120 }),
  ];
  const base = { sessions, segments: [], timezone: "Asia/Tokyo", nowMs: now, minimumStreakSeconds: 600, displayName: "あきら" };

  it("合計・日別・連続日数・最近の便（新しい順、ダイバート先）を作る", () => {
    const p = buildPublicStats({ ...base, showSubjects: true });
    expect(p.totals).toMatchObject({ focusSeconds: 5400, flights: 2 });
    expect(p.days).toEqual({ "2026-10-29": 1800, "2026-10-28": 3600 });
    expect(p.streakDays).toBe(2);
    expect(p.recent.map((r) => `${r.from}-${r.to}`)).toEqual(["NGO-HND", "HND-FSZ"]);
    expect(p.recent[0]).toMatchObject({ minutes: 30, subject: "口腔生理学" });
  });
  it("メモ・タスク名は含めず、科目名は許可したときだけ", () => {
    const p = buildPublicStats({ ...base, showSubjects: false });
    const json = JSON.stringify(p);
    expect(json).not.toContain("秘密のメモ");
    expect(json).not.toContain("問題集");
    expect(json).not.toContain("口腔生理学");
    expect(p.recent[0].subject).toBeUndefined();
  });
  it("最近の便は上限まで", () => {
    const many = Array.from({ length: 40 }, (_, i) => done(`m${i}`, 10, new Date(now - i * 3600_000).toISOString()));
    expect(buildPublicStats({ ...base, sessions: many, showSubjects: true }).recent).toHaveLength(PUBLIC_RECENT);
  });
});
