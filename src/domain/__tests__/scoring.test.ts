import { describe, expect, it } from "vitest";
import { computeAchievements, computeSkyPoints, rankFor } from "../scoring";

describe("SkyPoints", () => {
  it("満1分につき1pt", () => {
    expect(computeSkyPoints({ status: "completed", actualFocusSeconds: 599, plannedSeconds: 1200 })).toBe(9);
  });
  it("20分以上・80%以上でボーナス+10", () => {
    expect(computeSkyPoints({ status: "completed", actualFocusSeconds: 960, plannedSeconds: 1200 })).toBe(26);
    expect(computeSkyPoints({ status: "completed", actualFocusSeconds: 959, plannedSeconds: 1200 })).toBe(15);
    expect(computeSkyPoints({ status: "completed", actualFocusSeconds: 900, plannedSeconds: 900 })).toBe(15);
  });
  it("放棄は0", () => {
    expect(computeSkyPoints({ status: "abandoned", actualFocusSeconds: 3000, plannedSeconds: 3000 })).toBe(0);
  });
});

describe("ランク", () => {
  it("境界", () => {
    expect(rankFor(0).rank.id).toBe("cadet");
    expect(rankFor(99).rank.id).toBe("cadet");
    expect(rankFor(100).rank.id).toBe("navigator");
    expect(rankFor(1500).rank.id).toBe("captain");
    expect(rankFor(1500).next).toBeNull();
    expect(rankFor(300).progressToNext).toBeCloseTo(0.5);
  });
});

describe("実績", () => {
  it("達成判定", () => {
    const a = computeAchievements({ completedFlights: 1, totalFocusSeconds: 60_000, visitedAirports: 2, visitedCountries: 1, longestStreak: 7, longestFlightKm: 100, longestSessionSeconds: 5400 });
    const byId = Object.fromEntries(a.map((x) => [x.id, x.achieved]));
    expect(byId.first_flight).toBe(true);
    expect(byId.ten_landings).toBe(false);
    expect(byId.thousand_minutes).toBe(true);
    expect(byId.streak_7).toBe(true);
    expect(byId.deep_focus).toBe(true);
  });
});
