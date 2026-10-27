import { describe, expect, it } from "vitest";
import { addDays, dayKey, splitIntervalByDay, startOfDayMs, weekStart, weekdayIndex, zonedToUtc } from "../zoned";

describe("タイムゾーン暦日", () => {
  it("同じ瞬間でもタイムゾーンで日付が異なる", () => {
    const t = Date.parse("2026-10-27T16:00:00Z");
    expect(dayKey(t, "Asia/Tokyo")).toBe("2026-10-28");
    expect(dayKey(t, "America/New_York")).toBe("2026-10-27");
    expect(dayKey(t, "UTC")).toBe("2026-10-27");
  });

  it("その日の0時", () => {
    expect(new Date(startOfDayMs("2026-10-28", "Asia/Tokyo")).toISOString()).toBe("2026-10-27T15:00:00.000Z");
  });

  it("DST 切替日も正しい0時（ニューヨーク 2026-11-01）", () => {
    expect(new Date(startOfDayMs("2026-11-01", "America/New_York")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(startOfDayMs("2026-11-02", "America/New_York")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(new Date(zonedToUtc(2026, 3, 8, 12, 0, 0, "America/New_York")).toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });

  it("週は月曜始まり", () => {
    expect(weekdayIndex("2026-10-26")).toBe(0); // 月
    expect(weekdayIndex("2026-11-01")).toBe(6); // 日
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("日付跨ぎ区間を分割", () => {
    // JST 23:30 → 翌 00:45
    const start = Date.parse("2026-10-27T14:30:00Z");
    const end = Date.parse("2026-10-27T15:45:00Z");
    expect(splitIntervalByDay(start, end, "Asia/Tokyo")).toEqual([
      { day: "2026-10-27", seconds: 1800 },
      { day: "2026-10-28", seconds: 2700 },
    ]);
    expect(splitIntervalByDay(start, end, "UTC")).toEqual([{ day: "2026-10-27", seconds: 4500 }]);
    expect(splitIntervalByDay(end, start, "UTC")).toEqual([]);
  });
});
