import { describe, expect, it } from "vitest";
import { displayScale, globeAnchor, GLOBE_RADIUS, mercator, mercatorAnchor, metersPerPixel, mix, multiply, planeAttitude, shadowAttitude, transformPoint } from "./plane3dMath";

const close = (a: number[], b: number[], eps = 1e-9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));

describe("planeAttitude", () => {
  it("機首（モデル +X）は方位の向き、上（+Z）は上", () => {
    close(transformPoint(planeAttitude(0, 0, 0, 1, 0), [1, 0, 0]).slice(0, 3), [0, 1, 0]); // 北
    close(transformPoint(planeAttitude(90, 0, 0, 1, 0), [1, 0, 0]).slice(0, 3), [1, 0, 0]); // 東
    close(transformPoint(planeAttitude(225, 0, 0, 1, 0), [1, 0, 0]).slice(0, 3), [-Math.SQRT1_2, -Math.SQRT1_2, 0]); // 南西
    close(transformPoint(planeAttitude(37, 0, 0, 1, 0), [0, 0, 1]).slice(0, 3), [0, 0, 1]);
  });
  it("機首上げ・右バンク・拡大・高度", () => {
    const up = transformPoint(planeAttitude(0, 10, 0, 1, 0), [1, 0, 0]);
    expect(up[2]).toBeGreaterThan(0.17);
    // 左翼（+Y）は右バンクで上がる
    expect(transformPoint(planeAttitude(0, 0, 20, 1, 0), [0, 1, 0])[2]).toBeGreaterThan(0.3);
    close(transformPoint(planeAttitude(90, 0, 0, 3, 500), [2, 0, 0]).slice(0, 3), [6, 0, 500]);
  });
  it("影は高さが潰れ、南東へずれる", () => {
    const p = transformPoint(shadowAttitude(0, 1, 550), [0, 0, 5]);
    expect(p[2]).toBeCloseTo(0.5);
    expect(p[0]).toBeGreaterThan(0);
    expect(p[1]).toBeLessThan(0);
  });
});

describe("anchors", () => {
  it("メルカトル: 原点は地点の座標、北は -y", () => {
    const m = mercatorAnchor(139.78, 35.55, 0);
    const { x, y, metersToUnits } = mercator(139.78, 35.55);
    close(transformPoint(m, [0, 0, 0]).slice(0, 2), [x, y]);
    const north = transformPoint(m, [0, 1000, 0]);
    expect(north[1]).toBeLessThan(y);
    expect(north[1]).toBeCloseTo(y - 1000 * metersToUnits, 12);
  });
  it("地球儀: 原点は球面上（MapLibre と同じ軸）、上方向は外向き、東・北は直交", () => {
    const g = globeAnchor(0, 0, 0);
    close(transformPoint(g, [0, 0, 0]).slice(0, 3), [0, 0, 1]);
    const e = transformPoint(g, [GLOBE_RADIUS, 0, 0]);
    close(e.slice(0, 3), [1, 0, 1]); // 経度0・緯度0 の東は +x
    const n = transformPoint(globeAnchor(90, 0, 0), [0, GLOBE_RADIUS, 0]);
    close(n.slice(0, 3), [1, 1, 0]); // 北は +y
    const hi = transformPoint(globeAnchor(0, 45, GLOBE_RADIUS), [0, 0, 0]);
    close(hi.slice(0, 3), [0, 2 * Math.SQRT1_2, 2 * Math.SQRT1_2]);
  });
  it("行列の線形結合は、変換後の点の線形結合と等しい（地図の投影切り替えと同じ）", () => {
    const a = mercatorAnchor(10, 20, 0);
    const b = globeAnchor(10, 20, 0);
    const p: [number, number, number] = [30, -12, 50];
    const t = 0.3;
    const mixed = transformPoint(mix(b, a, t), p);
    const pa = transformPoint(a, p);
    const pb = transformPoint(b, p);
    close(mixed, pb.map((v, i) => t * v + (1 - t) * pa[i]));
  });
  it("行列の積", () => {
    const m = multiply(mercatorAnchor(0, 0, 0), planeAttitude(90, 0, 0, 1, 0));
    expect(transformPoint(m, [1000, 0, 0])[0]).toBeGreaterThan(0.5);
  });
});

describe("表示の大きさ", () => {
  it("ズームが1上がると1ピクセルの距離は半分", () => {
    expect(metersPerPixel(0, 10) / metersPerPixel(0, 11)).toBeCloseTo(2);
  });
  it("巡航中も機体が画面上で見える大きさになる", () => {
    const s = displayScale(35, 9.6, 110);
    expect((62.8 * s) / metersPerPixel(35, 9.6)).toBeCloseTo(110, 0);
    expect(displayScale(35, 20, 1)).toBe(1); // 実寸より小さくはしない
  });
});
