// 3D 機体の配置に使う行列計算（WebGL に依存しない純粋関数。列優先の 4x4 行列）。
//
// 機体のローカル座標は東・北・上（ENU、メートル）。MapLibre の地図は
// - メルカトル: x = 東、y = 南、z = 上（単位はメルカトル座標）
// - 地球儀: 半径 1 の球（x = sin(経度)cos(緯度), y = sin(緯度), z = cos(経度)cos(緯度)）
// で描かれ、ズームに応じて両者を projectionTransition で混ぜる。
// 頂点ごとの混合は行列の線形結合と等しいので、両方の行列を作って混ぜれば地図と同じ位置に描ける。

export type Mat4 = Float64Array;

export const GLOBE_RADIUS = 6371008.8;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
/** MapLibre のタイルサイズ（ワールドの幅 = 512 * 2^zoom ピクセル） */
const TILE_SIZE = 512;

export function mat4(): Mat4 {
  const m = new Float64Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Mat4 {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/** t * a + (1 - t) * b */
export function mix(a: ArrayLike<number>, b: ArrayLike<number>, t: number): Mat4 {
  const out = new Float64Array(16);
  for (let i = 0; i < 16; i++) out[i] = t * a[i] + (1 - t) * b[i];
  return out;
}

export function transformPoint(m: ArrayLike<number>, p: [number, number, number]): [number, number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

/** Web メルカトル座標（0..1、y は南向き）。 */
export function mercator(lng: number, lat: number): { x: number; y: number; metersToUnits: number } {
  const x = (180 + lng) / 360;
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
  const metersToUnits = 1 / (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180));
  return { x, y, metersToUnits };
}

/** ENU（メートル）→ メルカトル座標。地点 (lng, lat) の標高 elevation（m）を原点にする。 */
export function mercatorAnchor(lng: number, lat: number, elevation: number): Mat4 {
  const { x, y, metersToUnits: k } = mercator(lng, lat);
  const m = new Float64Array(16);
  m[0] = k; // 東 → x
  m[5] = -k; // 北 → -y（メルカトルの y は南向き）
  m[10] = k; // 上 → z
  m[12] = x;
  m[13] = y;
  m[14] = elevation * k;
  m[15] = 1;
  return m;
}

/** ENU（メートル）→ 地球儀の単位球座標。 */
export function globeAnchor(lng: number, lat: number, elevation: number): Mat4 {
  const lam = (lng * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const up = [Math.sin(lam) * Math.cos(phi), Math.sin(phi), Math.cos(lam) * Math.cos(phi)];
  const east = [Math.cos(lam), 0, -Math.sin(lam)];
  const north = [-Math.sin(lam) * Math.sin(phi), Math.cos(phi), -Math.cos(lam) * Math.sin(phi)];
  const s = 1 / GLOBE_RADIUS;
  const r = 1 + elevation / GLOBE_RADIUS;
  const m = new Float64Array(16);
  m.set([east[0] * s, east[1] * s, east[2] * s, 0], 0);
  m.set([north[0] * s, north[1] * s, north[2] * s, 0], 4);
  m.set([up[0] * s, up[1] * s, up[2] * s, 0], 8);
  m.set([up[0] * r, up[1] * r, up[2] * r, 1], 12);
  return m;
}

/**
 * 機体の姿勢と大きさ（モデル座標 → ENU）。モデルは機首 +X・上 +Z・左翼 +Y（メートル）。
 * bearing: 機首方位（度、北から時計回り）、pitch: 機首上げ（度）、bank: 右に傾ける角度（度）。
 */
export function planeAttitude(bearingDeg: number, pitchDeg: number, bankDeg: number, scale: number, altitude: number): Mat4 {
  const yaw = ((90 - bearingDeg) * Math.PI) / 180; // ENU で +X（東）から反時計回り
  const p = (pitchDeg * Math.PI) / 180;
  const b = (bankDeg * Math.PI) / 180;
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(p),
    sp = Math.sin(p);
  const cb = Math.cos(b),
    sb = Math.sin(b);
  // R = Rz(yaw) * Ry(-pitch) * Rx(bank)
  const ry = [cp, 0, sp, 0, 0, 1, 0, 0, -sp, 0, cp, 0, 0, 0, 0, 1]; // 機首上げ（+X が +Z へ）
  const rx = [1, 0, 0, 0, 0, cb, sb, 0, 0, -sb, cb, 0, 0, 0, 0, 1]; // 右翼を下げる
  const rz = [cy, sy, 0, 0, -sy, cy, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const r = multiply(rz, multiply(ry, rx));
  const m = new Float64Array(16);
  for (let c = 0; c < 3; c++) for (let i = 0; i < 3; i++) m[c * 4 + i] = r[c * 4 + i] * scale;
  m[14] = altitude;
  m[15] = 1;
  return m;
}

/** 地面に落ちる影（高さを潰し、太陽と反対側＝南東へ distance メートルずらす）。 */
export function shadowAttitude(bearingDeg: number, scale: number, distance: number, groundOffset = 0.5): Mat4 {
  const m = planeAttitude(bearingDeg, 0, 0, scale, 0);
  m[2] = m[6] = m[10] = 0; // 高さ方向を潰す
  const d = distance;
  m[12] = d * Math.SQRT1_2;
  m[13] = -d * Math.SQRT1_2;
  m[14] = groundOffset;
  return m;
}

/** 緯度・ズームでの 1 ピクセルあたりのメートル。 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
}

/** 機体を画面上で lengthPx ピクセル程度に見せるための拡大率（実機の全長 62.8m）。 */
export const MODEL_LENGTH_M = 62.8;
export function displayScale(lat: number, zoom: number, lengthPx: number): number {
  return Math.max(1, (lengthPx * metersPerPixel(lat, zoom)) / MODEL_LENGTH_M);
}
