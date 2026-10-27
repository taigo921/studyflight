// 実在路線（OpenFlights の直行便データ）にもとづく行き先候補と経由ルートの探索（純粋関数）。
//
// - 予定飛行時間は距離からの推定値（flight-time.ts）。実際の時刻表の値ではない。
// - 路線データにある直行便（source = "route"）と、データにない空港間の推定（source = "estimated"）を必ず区別する。

import { estimatedBlockMinutes, sessionsNeeded } from "./flight-time";
import { haversineKm, type LngLat } from "./geo";
import type { Airport } from "./types";

export interface RouteEdge {
  to: string;
  /** 就航実績のある航空会社コード（OpenFlights, 2014年時点） */
  carriers: string[];
}
export type RouteGraph = Map<string, RouteEdge[]>;

export function parseRouteGraph(json: { routes: Record<string, [string, string][]> }): RouteGraph {
  const g: RouteGraph = new Map();
  for (const [from, list] of Object.entries(json.routes)) g.set(from, list.map(([to, c]) => ({ to, carriers: c ? c.split(" ") : [] })));
  return g;
}

const pos = (a: Pick<Airport, "lng" | "lat">): LngLat => [a.lng, a.lat];

export interface FlightCandidate {
  airport: Airport;
  source: "route" | "estimated";
  carriers: string[];
  distanceKm: number;
  /** 推定予定飛行時間（分） */
  blockMinutes: number;
  /** この学習時間で何回に分けて飛ぶか */
  sessions: number;
  /** 最終目的地への前進度（0..1 の割合で、マイナスは遠ざかる）。最終目的地なしは null */
  finalProgress: number | null;
  finalRemainingKm: number | null;
}

export interface Tolerance {
  minus: number;
  plus: number;
}

export interface SearchInput {
  origin: Airport;
  studyMinutes: number;
  tolerance: Tolerance;
  byId: Map<string, Airport>;
  airports: readonly Airport[];
  graph: RouteGraph | null;
  final?: Airport | null;
  /** 路線データがある空港でも推定候補を含めるか */
  includeEstimated?: boolean;
}

export interface SearchResult {
  /** 学習時間 ± 許容幅に収まる便 */
  fit: FlightCandidate[];
  /** 許容幅より長い便（複数回に分けて飛ぶ） */
  longer: FlightCandidate[];
  /** 許容幅より短い便 */
  shorter: FlightCandidate[];
  /** 出発空港に路線データがあるか */
  hasRouteData: boolean;
}

function candidate(origin: Airport, a: Airport, source: FlightCandidate["source"], carriers: string[], studyMinutes: number, final?: Airport | null): FlightCandidate {
  const distanceKm = haversineKm(pos(origin), pos(a));
  const blockMinutes = estimatedBlockMinutes(distanceKm);
  let finalProgress: number | null = null;
  let finalRemainingKm: number | null = null;
  if (final) {
    const before = haversineKm(pos(origin), pos(final));
    finalRemainingKm = haversineKm(pos(a), pos(final));
    finalProgress = before > 0 ? (before - finalRemainingKm) / before : 0;
  }
  return { airport: a, source, carriers, distanceKm, blockMinutes, sessions: sessionsNeeded(blockMinutes, studyMinutes), finalProgress, finalRemainingKm };
}

/** 任意の空港への候補（路線データに直行便があれば route、なければ estimated）。 */
export function buildCandidate(origin: Airport, a: Airport, graph: RouteGraph | null, studyMinutes: number, final?: Airport | null): FlightCandidate {
  const edge = graph?.get(origin.id)?.find((e) => e.to === a.id);
  return candidate(origin, a, edge ? "route" : "estimated", edge?.carriers ?? [], studyMinutes, final);
}

/** 旅の目的地として扱う空港（IATA コードを持つ大・中規模空港）。 */
export function isPassengerAirport(a: Airport): boolean {
  return !!a.iata && (a.type === "large_airport" || a.type === "medium_airport");
}

export function searchFlights(input: SearchInput): SearchResult {
  const { origin, studyMinutes, tolerance, byId, airports, graph, final, includeEstimated } = input;
  const lo = Math.max(0, studyMinutes - tolerance.minus);
  const hi = studyMinutes + tolerance.plus;
  const edges = graph?.get(origin.id) ?? [];
  const hasRouteData = edges.length > 0;
  const list: FlightCandidate[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const a = byId.get(e.to);
    if (!a || a.id === origin.id) continue;
    list.push(candidate(origin, a, "route", e.carriers, studyMinutes, final));
    seen.add(a.id);
  }
  if (!hasRouteData || includeEstimated) {
    // 路線データにない空港間は推定。範囲内の空港だけ（多すぎないよう上限を設ける）
    for (const a of airports) {
      if (seen.has(a.id) || a.id === origin.id || !isPassengerAirport(a)) continue;
      const km = haversineKm(pos(origin), pos(a));
      if (km < 30) continue;
      const m = estimatedBlockMinutes(km);
      if (m < lo || m > hi) continue;
      list.push(candidate(origin, a, "estimated", [], studyMinutes, final));
    }
  }
  const byFit = (x: FlightCandidate, y: FlightCandidate) => {
    if (final && x.finalProgress !== null && y.finalProgress !== null && Math.abs(x.finalProgress - y.finalProgress) > 0.02) return y.finalProgress - x.finalProgress;
    return Math.abs(x.blockMinutes - studyMinutes) - Math.abs(y.blockMinutes - studyMinutes) || (x.source === y.source ? 0 : x.source === "route" ? -1 : 1);
  };
  const fit = list.filter((c) => c.blockMinutes >= lo && c.blockMinutes <= hi).sort(byFit);
  const longer = list.filter((c) => c.blockMinutes > hi && c.source === "route").sort((x, y) => x.blockMinutes - y.blockMinutes);
  const shorter = list.filter((c) => c.blockMinutes < lo && c.source === "route").sort((x, y) => y.blockMinutes - x.blockMinutes);
  return { fit: fit.slice(0, 80), longer: longer.slice(0, 40), shorter: shorter.slice(0, 20), hasRouteData };
}

export interface ItineraryLeg {
  from: Airport;
  to: Airport;
  blockMinutes: number;
  distanceKm: number;
  carriers: string[];
}

/**
 * 最終目的地までの経由ルート（直行便データのみを使う）。推定予定飛行時間の合計に
 * 乗り継ぎ1回あたり LEG_PENALTY 分を加えたコストが最小の経路を返す。到達不能なら null。
 */
const LEG_PENALTY = 45;
export function planItinerary(graph: RouteGraph, byId: Map<string, Airport>, fromId: string, toId: string, maxLegs = 6): ItineraryLeg[] | null {
  if (fromId === toId) return [];
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { id: string; carriers: string[]; legs: number }>();
  const legsTo = new Map<string, number>([[fromId, 0]]);
  // 二分ヒープ
  const heap: [number, string][] = [[0, fromId]];
  const push = (item: [number, string]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, string] | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (let item = pop(); item; item = pop()) {
    const [d, id] = item;
    if (id === toId) break;
    if (d > (dist.get(id) ?? Infinity)) continue;
    const here = byId.get(id);
    const nLegs = legsTo.get(id) ?? 0;
    if (!here || nLegs >= maxLegs) continue;
    for (const e of graph.get(id) ?? []) {
      const next = byId.get(e.to);
      if (!next) continue;
      const nd = d + estimatedBlockMinutes(haversineKm(pos(here), pos(next))) + (id === fromId ? 0 : LEG_PENALTY);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { id, carriers: e.carriers, legs: nLegs + 1 });
        legsTo.set(e.to, nLegs + 1);
        push([nd, e.to]);
      }
    }
  }
  if (!prev.has(toId)) return null;
  const legs: ItineraryLeg[] = [];
  for (let cur = toId; cur !== fromId; ) {
    const p = prev.get(cur)!;
    const from = byId.get(p.id)!;
    const to = byId.get(cur)!;
    const distanceKm = haversineKm(pos(from), pos(to));
    legs.unshift({ from, to, distanceKm, blockMinutes: estimatedBlockMinutes(distanceKm), carriers: p.carriers });
    cur = p.id;
  }
  return legs;
}
