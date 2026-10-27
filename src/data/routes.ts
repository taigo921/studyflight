// 実在路線（OpenFlights 直行便データ, ODbL）の読み込み。失敗しても推定候補で動作を続ける。
import { parseRouteGraph, type RouteGraph } from "@/domain/route-search";
import { withBase } from "@/lib/base-path";

export const ROUTE_DATA_CREDIT = { label: "OpenFlights 路線データ（ODbL 1.0, 2014年時点）", href: "https://openflights.org/data" };

let pending: Promise<RouteGraph | null> | null = null;

export function loadRouteGraph(): Promise<RouteGraph | null> {
  if (!pending) {
    pending = fetch(withBase("/data/routes.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j ? parseRouteGraph(j) : null))
      .catch(() => null);
    pending.then((g) => g === null && (pending = null));
  }
  return pending;
}
