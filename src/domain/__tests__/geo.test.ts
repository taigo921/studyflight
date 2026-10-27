import { describe, expect, it } from "vitest";
import { flightPositionAt, greatCirclePoints, haversineKm, initialBearing, splitAtAntimeridian, unwrapLongitudes, type LngLat } from "../geo";

const HND: LngLat = [139.787, 35.55];
const NKM: LngLat = [136.924, 35.256];
const LAX: LngLat = [-118.408, 33.942];
const JFK: LngLat = [-73.779, 40.639];
const LHR: LngLat = [-0.46, 51.47];

describe("距離", () => {
  it("ハーサイン距離の概算", () => {
    expect(haversineKm(HND, LAX)).toBeGreaterThan(8700);
    expect(haversineKm(HND, LAX)).toBeLessThan(8900);
    expect(haversineKm(JFK, LHR)).toBeGreaterThan(5500);
    expect(haversineKm(JFK, LHR)).toBeLessThan(5600);
    expect(haversineKm(HND, HND)).toBe(0);
  });
});

describe("大圏航路", () => {
  it("両端を含む点列", () => {
    const pts = greatCirclePoints(NKM, HND, 128);
    expect(pts).toHaveLength(129);
    expect(pts[0][0]).toBeCloseTo(NKM[0], 6);
    expect(pts[128][1]).toBeCloseTo(HND[1], 6);
  });

  it("北半球の東西航路は高緯度側に膨らむ", () => {
    const mid = greatCirclePoints(JFK, LHR, 2)[1];
    expect(mid[1]).toBeGreaterThan(51.47);
  });

  it("日付変更線をまたぐ航路を分割しワープしない", () => {
    const pts = greatCirclePoints(HND, LAX, 256);
    const lines = splitAtAntimeridian(pts);
    expect(lines.length).toBe(2);
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
    }
    expect(Math.abs(lines[0][lines[0].length - 1][0])).toBe(180);
    expect(Math.abs(lines[1][0][0])).toBe(180);
    expect(lines[0][lines[0].length - 1][1]).toBeCloseTo(lines[1][0][1], 9);
  });

  it("日付変更線をまたがない航路は1本", () => {
    expect(splitAtAntimeridian(greatCirclePoints(JFK, LHR))).toHaveLength(1);
  });

  it("経度の連続化", () => {
    const un = unwrapLongitudes(greatCirclePoints(HND, LAX, 64));
    for (let i = 1; i < un.length; i++) expect(Math.abs(un[i][0] - un[i - 1][0])).toBeLessThan(180);
    expect(un[un.length - 1][0]).toBeCloseTo(LAX[0] + 360, 3);
  });
});

describe("機体位置", () => {
  it("進捗0/1で端点", () => {
    expect(flightPositionAt(NKM, HND, 0).position[0]).toBeCloseTo(NKM[0], 6);
    expect(flightPositionAt(NKM, HND, 1).position[0]).toBeCloseTo(HND[0], 6);
  });
  it("範囲外・NaN はクランプ", () => {
    expect(flightPositionAt(NKM, HND, 2).progress).toBe(1);
    expect(flightPositionAt(NKM, HND, NaN).progress).toBe(0);
  });
  it("決定論的で、残距離 + 飛行距離 = 全距離", () => {
    const a = flightPositionAt(HND, LAX, 0.37);
    const b = flightPositionAt(HND, LAX, 0.37);
    expect(a).toEqual(b);
    expect(a.flownKm + a.remainingKm).toBeCloseTo(haversineKm(HND, LAX), 6);
  });
  it("東向きの方位", () => {
    const b = initialBearing(NKM, HND);
    expect(b).toBeGreaterThan(45);
    expect(b).toBeLessThan(135);
  });
});
