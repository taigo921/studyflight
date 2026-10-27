// 予定飛行時間（ブロックタイム）の推定。
//
// 公開の路線データ（OpenFlights）には予定飛行時間が含まれないため、距離から推定する。
// 係数は約5.9万路線の公開時刻表統計から、距離帯ごとの中央値を結ぶ折れ線として求めた
// （平均誤差は約10分。風向・空港混雑・機材で実際の時刻表とは異なる）。
// UI では必ず「推定」と表示し、実際の時刻表の値と混同しない。

/** [距離 km, 予定飛行時間 分] の折れ線の節点 */
const KNOTS: readonly [number, number][] = [
  [0, 20],
  [190, 50],
  [453, 75],
  [802, 103],
  [1423, 150],
  [2668, 245],
  [5455, 445],
  [9309, 715],
];

/** 推定予定飛行時間（分、5分単位）。 */
export function estimatedBlockMinutes(km: number): number {
  const d = Math.max(0, km);
  let minutes: number;
  const last = KNOTS[KNOTS.length - 1];
  if (d >= last[0]) {
    const prev = KNOTS[KNOTS.length - 2];
    minutes = last[1] + ((d - last[0]) * (last[1] - prev[1])) / (last[0] - prev[0]);
  } else {
    let i = 1;
    while (KNOTS[i][0] < d) i++;
    const [x0, y0] = KNOTS[i - 1];
    const [x1, y1] = KNOTS[i];
    minutes = y0 + ((d - x0) * (y1 - y0)) / (x1 - x0);
  }
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** 指定した予定飛行時間（分）で届く距離の目安（km）。地図上の範囲表示用。 */
export function kmForBlockMinutes(minutes: number): number {
  if (minutes <= KNOTS[0][1]) return 0;
  for (let i = 1; i < KNOTS.length; i++) {
    const [x0, y0] = KNOTS[i - 1];
    const [x1, y1] = KNOTS[i];
    if (minutes <= y1) return x0 + ((minutes - y0) * (x1 - x0)) / (y1 - y0);
  }
  const [x0, y0] = KNOTS[KNOTS.length - 2];
  const [x1, y1] = KNOTS[KNOTS.length - 1];
  return x1 + ((minutes - y1) * (x1 - x0)) / (y1 - y0);
}

/** 区間を学習時間で割ったときに必要な回数。 */
export function sessionsNeeded(remainingMinutes: number, studyMinutes: number): number {
  if (studyMinutes <= 0) return Infinity;
  return Math.max(1, Math.ceil(remainingMinutes / studyMinutes - 1e-9));
}
