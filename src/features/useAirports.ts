"use client";

import { useEffect, useState } from "react";
import { loadAirports, type AirportStore } from "@/data/airports";
import { CORE_AIRPORTS } from "@/data/core-airports";

const fallback: AirportStore = { airports: CORE_AIRPORTS, byId: new Map(CORE_AIRPORTS.map((a) => [a.id, a])), source: "fallback" };

/** 空港データ。読み込み完了までは最小データで即座に描画できる。 */
export function useAirports(): AirportStore & { loading: boolean } {
  const [store, setStore] = useState<AirportStore | null>(null);
  useEffect(() => {
    let alive = true;
    loadAirports().then((s) => alive && setStore(s));
    return () => {
      alive = false;
    };
  }, []);
  return store ? { ...store, loading: false } : { ...fallback, loading: true };
}
