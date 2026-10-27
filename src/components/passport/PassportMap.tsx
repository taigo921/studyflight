"use client";

import { useEffect, useMemo, useState } from "react";
import { greatCirclePoints, splitAtAntimeridian, type LngLat } from "@/domain/geo";
import { loadWorldLand, type LandCollection } from "@/lib/world";

function landPath(land: LandCollection): string {
  const ring = (r: LngLat[]) => r.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${(-y).toFixed(1)}`).join("") + "Z";
  let d = "";
  for (const f of land.features) {
    if (f.geometry.type === "Polygon") d += (f.geometry.coordinates as LngLat[][]).map(ring).join("");
    else for (const p of f.geometry.coordinates as LngLat[][][]) d += p.map(ring).join("");
  }
  return d;
}

/** 訪問した空港と飛んだ路線の世界地図（正距円筒図法）。 */
export function PassportMap({ airports, routes }: { airports: { id: string; code: string; pos: LngLat }[]; routes: [LngLat, LngLat][] }) {
  const [land, setLand] = useState<LandCollection | null>(null);
  useEffect(() => {
    let alive = true;
    loadWorldLand().then((l) => alive && setLand(l));
    return () => {
      alive = false;
    };
  }, []);
  const d = useMemo(() => (land ? landPath(land) : ""), [land]);
  const lines = useMemo(
    () => routes.flatMap(([a, b]) => splitAtAntimeridian(greatCirclePoints(a, b, 64))).map((l) => l.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${(-y).toFixed(2)}`).join("")),
    [routes],
  );
  return (
    <svg viewBox="-180 -84 360 144" className="w-full rounded-2xl bg-[#0a1830]" role="img" aria-label={`訪問した空港 ${airports.length} か所の世界地図`}>
      {d && <path d={d} fill="#17305a" stroke="#2f4d7a" strokeWidth={0.3} />}
      {lines.map((l, i) => (
        <path key={i} d={l} fill="none" stroke="#EBC77B" strokeOpacity={0.75} strokeWidth={0.8} strokeLinecap="round" />
      ))}
      {airports.map((a) => (
        <circle key={a.id} cx={a.pos[0]} cy={-a.pos[1]} r={1.8} fill="#66B3FF" stroke="#07101F" strokeWidth={0.6} />
      ))}
    </svg>
  );
}
