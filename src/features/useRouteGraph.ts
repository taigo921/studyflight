"use client";

import { useEffect, useState } from "react";
import { loadRouteGraph } from "@/data/routes";
import type { RouteGraph } from "@/domain/route-search";

/** 路線グラフ。読み込み中・失敗時は null（推定候補で代替）。 */
export function useRouteGraph(): { graph: RouteGraph | null; loading: boolean } {
  const [state, setState] = useState<{ graph: RouteGraph | null; loading: boolean }>({ graph: null, loading: true });
  useEffect(() => {
    let alive = true;
    loadRouteGraph().then((graph) => alive && setState({ graph, loading: false }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
