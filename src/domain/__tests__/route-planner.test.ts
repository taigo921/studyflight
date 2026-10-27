import { describe, expect, it } from "vitest";
import { journeyTrail, travelState, currentLocationId } from "../route-planner";
import type { FlightLeg } from "../types";
import { makeSession } from "./fixtures";

const done = (id: string, from: string, to: string, at: string, extra: Record<string, unknown> = {}) =>
  makeSession({ id, status: "completed", originAirportId: from, destinationAirportId: to, completedAt: at, ...extra });

function leg(overrides: Partial<FlightLeg>): FlightLeg {
  return {
    id: "L1",
    tripId: null,
    originAirportId: "RJTT",
    destinationAirportId: "RJCC",
    originCode: "HND",
    destinationCode: "CTS",
    routeSource: "route",
    carriers: ["JL"],
    distanceKm: 820,
    scheduledSeconds: 6000,
    flownSeconds: 0,
    status: "in_progress",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("現在地", () => {
  it("旧形式の記録: 最後に完了したフライトの到着空港。なければホーム", () => {
    const s = [done("1", "RJGG", "RJTT", "2026-10-01T00:00:00Z"), done("2", "RJTT", "RJCC", "2026-10-02T00:00:00Z")];
    expect(currentLocationId(s, "RJNA")).toBe("RJCC");
    expect(currentLocationId([], "RJNA")).toBe("RJNA");
    expect(currentLocationId([makeSession({ status: "abandoned" })], null)).toBeNull();
  });

  it("区間の途中なら上空（進捗つき）", () => {
    const st = travelState([], [leg({ flownSeconds: 1800 })], "RJNA");
    expect(st.kind).toBe("air");
    if (st.kind === "air") expect(st.progress).toBeCloseTo(0.3);
  });

  it("未飛行の区間は出発空港、到着済みの区間は到着空港", () => {
    expect(travelState([], [leg({})], null)).toEqual({ kind: "ground", airportId: "RJTT" });
    expect(travelState([], [leg({ status: "arrived", flownSeconds: 6000, arrivedAt: "2026-10-03T00:00:00Z" })], null)).toEqual({ kind: "ground", airportId: "RJCC" });
  });

  it("取り消した区間は無視して、その前の地点", () => {
    const s = [done("1", "RJGG", "RJTT", "2026-10-01T00:00:00Z")];
    expect(travelState(s, [leg({ status: "cancelled", flownSeconds: 600 })], null)).toEqual({ kind: "ground", airportId: "RJTT" });
  });
});

describe("旅の軌跡", () => {
  it("つながった旅を1本で、途切れた区間は null で区切る", () => {
    const s = [
      done("1", "RJGG", "RJTT", "2026-10-01T00:00:00Z"),
      done("2", "RJTT", "RJCC", "2026-10-02T00:00:00Z"),
      done("3", "RJCC", "ROAH", "2026-10-03T00:00:00Z"),
      done("4", "RJAA", "RKSI", "2026-10-04T00:00:00Z"),
    ];
    expect(journeyTrail(s)).toEqual(["RJGG", "RJTT", "RJCC", "ROAH", null, "RJAA", "RKSI"]);
  });

  it("分割して飛んだ区間は、到着したセッションで初めて到着地が加わる", () => {
    const s = [
      done("1", "RJTT", "RJCC", "2026-10-01T00:00:00Z", { legId: "L", reachedDestination: false }),
      done("2", "RJTT", "RJCC", "2026-10-02T00:00:00Z", { legId: "L", reachedDestination: false }),
      done("3", "RJTT", "RJCC", "2026-10-03T00:00:00Z", { legId: "L", reachedDestination: true }),
    ];
    expect(journeyTrail(s)).toEqual(["RJTT", "RJCC"]);
  });
});
