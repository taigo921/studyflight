import { describe, expect, it } from "vitest";
import dataset from "../../../public/data/airports.json";
import { parseAirportDataset } from "@/data/airports";
import { applyDiversion } from "@/data/sessions";
import { currentLocationId, destinationCandidates, flightMinutesFor, journeyTrail, nearestAirport, reachableKm } from "../route-planner";
import { makeSession } from "./fixtures";

const { airports } = parseAirportDataset(dataset);
const byId = new Map(airports.map((a) => [a.id, a]));
const A = (id: string) => byId.get(id)!;

describe("学習時間 → 飛べる距離", () => {
  it("800km/h 換算", () => {
    expect(reachableKm(60)).toBe(800);
    expect(flightMinutesFor(400)).toBe(30);
  });
});

describe("行き先候補", () => {
  it("中部から25分: 羽田・成田など、所要時間が近い国内空港", () => {
    const c = destinationCandidates(A("RJGG"), 25, airports);
    const codes = c.map((x) => x.airport.iata);
    expect(codes).toContain("HND");
    expect(codes).toContain("NRT");
    expect(codes).not.toContain("CTS");
    expect(c.every((x) => x.airport.id !== "RJGG")).toBe(true);
    expect(c.every((x) => Math.abs(x.flightMinutes - 25) <= 25 * 0.5)).toBe(true);
  });

  it("羽田から60分で新千歳、新千歳から長時間で那覇に行ける", () => {
    expect(destinationCandidates(A("RJTT"), 60, airports).map((x) => x.airport.iata)).toContain("CTS");
    const toOka = flightMinutesFor(destinationCandidates(A("RJCC"), 170, airports).find((x) => x.airport.iata === "OKA")?.distanceKm ?? 0);
    expect(toOka).toBeGreaterThan(150);
  });

  it("候補は最低8件、国内/海外を判定", () => {
    const c = destinationCandidates(A("ROAH"), 5, airports);
    expect(c.length).toBeGreaterThanOrEqual(8);
    const far = destinationCandidates(A("RJTT"), 240, airports);
    expect(far.some((x) => !x.domestic)).toBe(true);
  });
});

describe("現在地と旅の軌跡", () => {
  const done = (id: string, from: string, to: string, at: string, landed?: string) =>
    makeSession({ id, status: "completed", originAirportId: from, destinationAirportId: to, completedAt: at, landedAirportId: landed ?? null });

  it("最後に完了したフライトの着陸空港が現在地。なければホーム空港", () => {
    const s = [done("1", "RJGG", "RJTT", "2026-10-01T00:00:00Z"), done("2", "RJTT", "RJCC", "2026-10-02T00:00:00Z")];
    expect(currentLocationId(s, "RJNA")).toBe("RJCC");
    expect(currentLocationId([], "RJNA")).toBe("RJNA");
    expect(currentLocationId([makeSession({ status: "abandoned" })], null)).toBeNull();
  });

  it("ダイバートした場合は着陸した空港が現在地", () => {
    expect(currentLocationId([done("1", "RJGG", "ROAH", "2026-10-01T00:00:00Z", "RJFK")], null)).toBe("RJFK");
  });

  it("軌跡はつながった旅を1本で、途切れた区間は null で区切る", () => {
    const s = [
      done("1", "RJGG", "RJTT", "2026-10-01T00:00:00Z"),
      done("2", "RJTT", "RJCC", "2026-10-02T00:00:00Z"),
      done("3", "RJCC", "ROAH", "2026-10-03T00:00:00Z"),
      done("4", "RJAA", "RKSI", "2026-10-04T00:00:00Z"),
    ];
    expect(journeyTrail(s)).toEqual(["RJGG", "RJTT", "RJCC", "ROAH", null, "RJAA", "RKSI"]);
  });
});

describe("早期着陸のダイバート", () => {
  const base = makeSession({ status: "completed", completionType: "early", originAirportId: "RJTT", destinationAirportId: "ROAH", destinationCode: "OKA", plannedSeconds: 7200, distanceKm: 1550 });

  it("90%以上なら目的地に到着", () => {
    const s = applyDiversion({ ...base, actualFocusSeconds: 6600 }, byId, airports);
    expect(s.landedAirportId ?? null).toBeNull();
  });

  it("途中なら機体位置の最寄り空港に着陸し、距離も実際に飛んだ分になる", () => {
    const s = applyDiversion({ ...base, actualFocusSeconds: 3600 }, byId, airports);
    expect(s.landedAirportId).toBeTruthy();
    expect(s.landedAirportId).not.toBe("ROAH");
    expect(s.landedCode).toMatch(/^[A-Z]{3}$/);
    expect(s.distanceKm).toBeLessThan(1550);
  });

  it("最寄り空港", () => {
    expect(nearestAirport([139.78, 35.55], airports)?.id).toBe("RJTT");
  });
});
