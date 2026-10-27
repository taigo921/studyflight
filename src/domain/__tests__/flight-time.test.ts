import { describe, expect, it } from "vitest";
import { estimatedBlockMinutes, kmForBlockMinutes, sessionsNeeded } from "../flight-time";

describe("推定予定飛行時間", () => {
  it("国内線の実態に近い（羽田-新千歳 約820km → 100〜110分、羽田-那覇 約1550km → 155〜165分）", () => {
    expect(estimatedBlockMinutes(820)).toBeGreaterThanOrEqual(100);
    expect(estimatedBlockMinutes(820)).toBeLessThanOrEqual(110);
    expect(estimatedBlockMinutes(1550)).toBeGreaterThanOrEqual(155);
    expect(estimatedBlockMinutes(1550)).toBeLessThanOrEqual(165);
  });
  it("長距離（成田-ロサンゼルス 約8750km → 10時間前後）", () => {
    const m = estimatedBlockMinutes(8750);
    expect(m).toBeGreaterThan(620);
    expect(m).toBeLessThan(720);
  });
  it("短い離島便、5分単位、単調増加", () => {
    expect(estimatedBlockMinutes(30)).toBe(25);
    for (const km of [0, 77, 500, 3000, 12000]) expect(estimatedBlockMinutes(km) % 5).toBe(0);
    let prev = 0;
    for (let km = 0; km < 15000; km += 250) {
      const m = estimatedBlockMinutes(km);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
  it("逆変換", () => {
    expect(kmForBlockMinutes(20)).toBe(0);
    expect(Math.round(kmForBlockMinutes(103))).toBe(802);
    expect(kmForBlockMinutes(1000)).toBeGreaterThan(9309);
  });
  it("分割回数", () => {
    expect(sessionsNeeded(100, 30)).toBe(4);
    expect(sessionsNeeded(90, 30)).toBe(3);
    expect(sessionsNeeded(10, 30)).toBe(1);
  });
});
