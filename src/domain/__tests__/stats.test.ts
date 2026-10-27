import { describe, expect, it } from "vitest";
import { allocateSessionByDay, buildDailyTotals, computeStreaks, dailySeries, hourHeatmap, periodRange, subjectBreakdown, sumRange, summarize, visitedAirports } from "../stats";
import type { FlightSession, FocusSegment } from "../types";
import { makeSession } from "./fixtures";

const seg = (sessionId: string, start: string, end: string): FocusSegment => ({
  id: `${sessionId}-${start}`,
  sessionId,
  startedAt: start,
  endedAt: end,
  durationSeconds: (Date.parse(end) - Date.parse(start)) / 1000,
});

function completed(id: string, actual: number, overrides: Partial<FlightSession> = {}): FlightSession {
  return makeSession({ id, status: "completed", actualFocusSeconds: actual, plannedSeconds: actual, earnedSkyPoints: Math.floor(actual / 60), completedAt: "2026-10-27T03:00:00Z", ...overrides });
}

describe("日付跨ぎ配分", () => {
  it("休憩を除き各日に配分、合計は actualFocusSeconds に一致", () => {
    const s = completed("a", 3600);
    // JST 23:30-23:50 (20分) 休憩 00:10-00:50 (40分)
    const segs = [seg("a", "2026-10-27T14:30:00Z", "2026-10-27T14:50:00Z"), seg("a", "2026-10-27T15:10:00Z", "2026-10-27T15:50:00Z")];
    const alloc = allocateSessionByDay(s, segs, "Asia/Tokyo");
    expect(alloc.get("2026-10-27")).toBe(1200);
    expect(alloc.get("2026-10-28")).toBe(2400);
    // UTC では同日
    expect(allocateSessionByDay(s, segs, "UTC").get("2026-10-27")).toBe(3600);
  });

  it("端数があっても合計は厳密一致", () => {
    const s = completed("b", 100);
    const segs = [seg("b", "2026-10-27T14:59:59.400Z", "2026-10-27T15:00:39.400Z"), seg("b", "2026-10-27T15:10:00Z", "2026-10-27T15:11:00.300Z")];
    const alloc = allocateSessionByDay(s, segs, "Asia/Tokyo");
    expect([...alloc.values()].reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("セグメントなしは完了日に計上", () => {
    const alloc = allocateSessionByDay(completed("c", 600), [], "Asia/Tokyo");
    expect(alloc.get("2026-10-27")).toBe(600);
  });
});

describe("集計", () => {
  const sessions = [
    completed("a", 1500, { subjectId: "phys" }),
    completed("b", 3000, { subjectId: "bio", completedAt: "2026-10-26T03:00:00Z" }),
    makeSession({ id: "x", status: "abandoned", actualFocusSeconds: 900 }),
  ];
  const segments = [
    seg("a", "2026-10-27T02:00:00Z", "2026-10-27T02:25:00Z"),
    seg("b", "2026-10-26T02:00:00Z", "2026-10-26T02:50:00Z"),
    seg("x", "2026-10-27T05:00:00Z", "2026-10-27T05:15:00Z"),
  ];
  const totals = buildDailyTotals(sessions, segments, "Asia/Tokyo");

  it("completed のみ数える", () => {
    expect(totals.get("2026-10-27")?.total).toBe(1500);
    expect(totals.get("2026-10-26")?.total).toBe(3000);
  });

  it("期間・科目別", () => {
    const week = periodRange("week", "2026-10-27");
    expect(week).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(sumRange(totals, week.from, week.to)).toBe(4500);
    expect(subjectBreakdown(totals, week.from, week.to).get("bio")).toBe(3000);
    expect(dailySeries(totals, "2026-10-27", 3).map((d) => d.seconds)).toEqual([0, 3000, 1500]);
  });

  it("タイムゾーンを変えると再計算される", () => {
    const ny = buildDailyTotals(sessions, segments, "America/New_York");
    expect(ny.get("2026-10-25")?.total).toBe(3000); // 10/26 02:00Z = NY 10/25 22:00
    expect(ny.get("2026-10-26")?.total).toBe(1500);
    expect(ny.get("2026-10-27")).toBeUndefined();
  });

  it("ヒートマップ", () => {
    const grid = hourHeatmap(sessions, segments, "Asia/Tokyo");
    expect(grid[1][11]).toBe(1500); // 火曜 11時台
    expect(grid[0][11]).toBe(3000); // 月曜 11時台
  });

  it("サマリーと訪問空港", () => {
    const sum = summarize(sessions);
    expect(sum.completedFlights).toBe(2);
    expect(sum.totalFocusSeconds).toBe(4500);
    const visited = visitedAirports(sessions);
    expect(visited.get("RJTT")?.visits).toBe(2);
    expect(visited.get("RJTT")?.firstVisitedAt).toBe("2026-10-26T03:00:00Z");
  });
});

describe("連続学習日数", () => {
  const mk = (days: Record<string, number>) => new Map(Object.entries(days).map(([d, t]) => [d, { total: t, bySubject: new Map(), sessions: new Set<string>() }]));

  it("今日未達でも昨日まで続いていれば継続", () => {
    const t = mk({ "2026-10-24": 600, "2026-10-25": 900, "2026-10-26": 700, "2026-10-27": 100 });
    expect(computeStreaks(t, "2026-10-27", 600)).toEqual({ current: 3, longest: 3, todayAchieved: false });
  });

  it("途切れたらリセット、最長は保持", () => {
    const t = mk({ "2026-10-20": 600, "2026-10-21": 600, "2026-10-22": 600, "2026-10-23": 600, "2026-10-26": 600, "2026-10-27": 600 });
    expect(computeStreaks(t, "2026-10-27", 600)).toEqual({ current: 2, longest: 4, todayAchieved: true });
  });

  it("2日空くと0", () => {
    expect(computeStreaks(mk({ "2026-10-25": 600 }), "2026-10-27", 600).current).toBe(0);
  });
});
