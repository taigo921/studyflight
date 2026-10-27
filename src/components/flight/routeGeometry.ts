import { flightPositionAt, greatCirclePoints, splitAtAntimeridian, type LngLat } from "@/domain/geo";

export const ROUTE_SEGMENTS = 192;

export function routeLines(origin: LngLat, destination: LngLat): LngLat[][] {
  return splitAtAntimeridian(greatCirclePoints(origin, destination, ROUTE_SEGMENTS));
}

/** 進捗までの飛行済み区間。 */
export function flownLines(origin: LngLat, destination: LngLat, progress: number): LngLat[][] {
  const p = Math.min(1, Math.max(0, progress));
  const n = Math.max(1, Math.round(ROUTE_SEGMENTS * p));
  const pts: LngLat[] = [];
  for (let i = 0; i <= n; i++) pts.push(flightPositionAt(origin, destination, (p * i) / n).position);
  return splitAtAntimeridian(pts);
}

export function multiLine(lines: LngLat[][]): GeoJSON.Feature<GeoJSON.MultiLineString> {
  return { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } };
}

/** 距離から地球儀のズームを決める（短距離ほど寄る）。 */
export function zoomForDistance(km: number): number {
  const z = 5.6 - Math.log2(Math.max(1, km) / 220);
  return Math.min(5.6, Math.max(1.1, z));
}
