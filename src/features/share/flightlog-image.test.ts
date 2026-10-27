import { describe, expect, it } from "vitest";
import { formatFocus, projectRoute, SHARE_SIZES, shareLayout } from "./flightlog-image";

describe("share image", () => {
  it("SNS ごとのサイズ", () => {
    expect(SHARE_SIZES.story).toEqual({ w: 1080, h: 1920 });
    expect(SHARE_SIZES.feed).toEqual({ w: 1080, h: 1350 });
    expect(SHARE_SIZES.wide).toEqual({ w: 1200, h: 675 });
  });
  it.each(["story", "feed", "wide"] as const)("%s の配置は画像内に収まる", (f) => {
    const L = shareLayout(f);
    for (const b of [L.art, L.text]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(L.w);
      expect(b.y + b.h).toBeLessThanOrEqual(L.h);
    }
  });
  it("航路は枠の中に収まり、日付変更線をまたいでも近い向きで描く", () => {
    const box = { x: 0, y: 0, w: 1000, h: 600 };
    const { a, b } = projectRoute([139.78, 35.55], [-122.38, 37.62], box); // HND → SFO
    for (const p of [a, b]) {
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[0]).toBeLessThanOrEqual(1000);
    }
    expect(b[0]).toBeGreaterThan(a[0]); // 東へ（太平洋を横断）
  });
  it("同じ地点付近でも左右に離して描く", () => {
    const { a, b } = projectRoute([139.78, 35.55], [139.79, 35.56], { x: 0, y: 0, w: 1000, h: 600 });
    expect(Math.abs(b[0] - a[0])).toBeGreaterThanOrEqual(600);
  });
  it("時間の表記", () => {
    expect(formatFocus(25 * 60, "ja")).toBe("25分");
    expect(formatFocus(85 * 60, "ja")).toBe("1時間25分");
    expect(formatFocus(120 * 60, "ja")).toBe("2時間");
    expect(formatFocus(85 * 60, "en")).toBe("1h 25m");
  });
});
