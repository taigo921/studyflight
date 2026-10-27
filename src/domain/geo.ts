// 大圏航路・距離・方位の計算。座標は [lng, lat]（GeoJSON 順）。

export type LngLat = [number, number];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Vec3 = [number, number, number];

function toVec(p: LngLat): Vec3 {
  const lat = toRad(p[1]);
  const lng = toRad(p[0]);
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}

function toLngLat(v: Vec3): LngLat {
  const [x, y, z] = v;
  return [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))];
}

/** 球面線形補間。t ∈ [0, 1]。 */
export function slerp(a: LngLat, b: LngLat, t: number): LngLat {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return [a[0], a[1]];
  const s = Math.sin(omega);
  // 対蹠点（ほぼ180°）では大圏が一意に定まらないが、数値的に破綻しないよう微小にずらす
  if (s < 1e-9) return slerp(a, [b[0] + 1e-6, b[1] - 1e-6], t);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  return toLngLat([ka * va[0] + kb * vb[0], ka * va[1] + kb * vb[1], ka * va[2] + kb * vb[2]]);
}

/** 大圏航路の点列（両端含む segments+1 点）。 */
export function greatCirclePoints(a: LngLat, b: LngLat, segments = 128): LngLat[] {
  const pts: LngLat[] = [];
  for (let i = 0; i <= segments; i++) pts.push(slerp(a, b, i / segments));
  return pts;
}

/**
 * 180°経線をまたぐ線を分割する。またぐ箇所では ±180 上の交点を補間して両側に追加し、
 * 地図上で地球を一周する直線ワープを防ぐ。
 */
export function splitAtAntimeridian(points: LngLat[]): LngLat[][] {
  if (points.length === 0) return [];
  const lines: LngLat[][] = [[points[0]]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const delta = cur[0] - prev[0];
    if (Math.abs(delta) > 180) {
      const sign = prev[0] > 0 ? 1 : -1; // 東向きに +180 を越えるなら 1
      const prevLng = prev[0];
      const curLng = cur[0] + sign * 360; // 連続になるよう展開
      const t = (sign * 180 - prevLng) / (curLng - prevLng);
      const latCross = prev[1] + t * (cur[1] - prev[1]);
      lines[lines.length - 1].push([sign * 180, latCross]);
      lines.push([[-sign * 180, latCross], cur]);
    } else {
      lines[lines.length - 1].push(cur);
    }
  }
  return lines;
}

/** 経度を連続化する（MapLibre の globe ではこちらの方が滑らかに描ける）。 */
export function unwrapLongitudes(points: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  let offset = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const delta = points[i][0] - points[i - 1][0];
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    out.push([points[i][0] + offset, points[i][1]]);
  }
  return out;
}

/** 初期方位（度、北=0、時計回り）。 */
export function initialBearing(a: LngLat, b: LngLat): number {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface FlightPosition {
  position: LngLat;
  bearing: number;
  progress: number;
  flownKm: number;
  remainingKm: number;
}

/** 進捗率から機体位置と向きを決定論的に算出する（リロード後もズレない）。 */
export function flightPositionAt(origin: LngLat, destination: LngLat, progress: number): FlightPosition {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const total = haversineKm(origin, destination);
  const position = slerp(origin, destination, p);
  const ahead = p < 1 ? slerp(origin, destination, Math.min(1, p + 0.001)) : destination;
  const bearing = p < 1 ? initialBearing(position, ahead) : initialBearing(slerp(origin, destination, 0.999), destination);
  return { position, bearing, progress: p, flownKm: total * p, remainingKm: total * (1 - p) };
}

/** 正距円筒図法（2D フォールバック用）。 */
export function projectEquirect(p: LngLat, width: number, height: number): [number, number] {
  return [((p[0] + 180) / 360) * width, ((90 - p[1]) / 180) * height];
}

/** 出発点から方位・距離だけ進んだ地点（大圏上）。 */
export function destinationPoint(origin: LngLat, bearingDeg: number, km: number): LngLat {
  const δ = km / EARTH_RADIUS_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(origin[1]);
  const λ1 = toRad(origin[0]);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [((toDeg(λ2) + 540) % 360) - 180, toDeg(φ2)];
}

/** 出発点を中心とする半径 km の円（地図上の到達範囲の表示用）。 */
export function circlePolygon(center: LngLat, km: number, steps = 96): LngLat[] {
  const pts: LngLat[] = [];
  for (let i = 0; i <= steps; i++) pts.push(destinationPoint(center, (360 * i) / steps, km));
  return unwrapLongitudes(pts);
}

/** 最寄りの地点（線形探索。数千件なら十分速い）。 */
export function nearest<T extends { lng: number; lat: number }>(p: LngLat, items: readonly T[]): { item: T; km: number } | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const it of items) {
    // 緯度差だけで明らかに遠いものは飛ばす
    if (Math.abs(it.lat - p[1]) * 111 > bestKm) continue;
    const km = haversineKm(p, [it.lng, it.lat]);
    if (km < bestKm) {
      bestKm = km;
      best = it;
    }
  }
  return best ? { item: best, km: bestKm } : null;
}
