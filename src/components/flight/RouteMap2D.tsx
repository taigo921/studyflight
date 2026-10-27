"use client";

// WebGL 非対応・描画失敗・2D 設定時の軽量な航路図（SVG、正距円筒図法）。
// 経度を連続化した座標系で描き、日付変更線をまたいでもワープしない。

import { useEffect, useMemo, useState } from "react";
import { flightPositionAt, greatCirclePoints, unwrapLongitudes, type LngLat } from "@/domain/geo";
import { loadWorldLand, type LandCollection } from "@/lib/world";
import { PLANE_PATH } from "./PlaneGlyph";

function ringsToPath(rings: LngLat[][], shift: number): string {
  return rings.map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${(x + shift).toFixed(2)},${(-y).toFixed(2)}`).join("") + "Z").join("");
}

function landPath(land: LandCollection, shift: number): string {
  let d = "";
  for (const f of land.features) {
    if (f.geometry.type === "Polygon") d += ringsToPath(f.geometry.coordinates as LngLat[][], shift);
    else for (const poly of f.geometry.coordinates as LngLat[][][]) d += ringsToPath(poly, shift);
  }
  return d;
}

export function RouteMap2D({
  origin,
  destination,
  originCode,
  destinationCode,
  progress,
  fit = "route",
  className = "",
}: {
  origin: LngLat;
  destination: LngLat;
  originCode: string;
  destinationCode: string;
  progress: number;
  fit?: "route" | "world";
  className?: string;
}) {
  const [land, setLand] = useState<LandCollection | null>(null);
  useEffect(() => {
    let alive = true;
    loadWorldLand().then((l) => alive && setLand(l));
    return () => {
      alive = false;
    };
  }, []);

  const route = useMemo(() => unwrapLongitudes(greatCirclePoints(origin, destination, 160)), [origin, destination]);
  const shiftOf = route[0][0] - origin[0]; // 0
  const pos = flightPositionAt(origin, destination, progress);
  const idx = Math.min(route.length - 1, Math.round(progress * (route.length - 1)));
  const flown = route.slice(0, idx + 1);
  // 機体位置も連続化座標に合わせる
  const planeX = route[idx][0];
  const planeY = pos.position[1];
  const ahead = route[Math.min(route.length - 1, idx + 1)];
  const behind = route[Math.max(0, idx - 1)];
  const angle = (Math.atan2(-(ahead[1] - behind[1]), ahead[0] - behind[0]) * 180) / Math.PI;
  const rotation = 90 - angle;

  const view = useMemo(() => {
    if (fit === "world") return { x: -180, y: -90, w: 360, h: 180 };
    const xs = route.map((p) => p[0]);
    const ys = route.map((p) => -p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, (maxY - minY) * 1.6, 16) * 1.4;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const w = span;
    const h = span / 1.6;
    // 下部の操作パネルに隠れないよう、航路を画面の上寄りに置く
    return { x: cx - w / 2, y: cy - h / 2 + h * 0.16, w, h };
  }, [route, fit]);

  const s = view.w / 360; // 線幅・マーカーのスケール
  const toD = (pts: LngLat[]) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(3)},${(-y).toFixed(3)}`).join("");
  const end = route[route.length - 1];
  const landD = useMemo(() => (land ? [-360, 0, 360].map((sh) => landPath(land, sh)).join("") : ""), [land]);

  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid slice"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label={`${originCode}から${destinationCode}への航路図。進捗${Math.round(progress * 100)}%`}
    >
      <rect x={view.x - 400} y={view.y - 400} width={view.w + 800} height={view.h + 800} fill="#0a1830" />
      {Array.from({ length: 25 }, (_, i) => -540 + i * 45).map((x) => (
        <line key={`v${x}`} x1={x} x2={x} y1={-90} y2={90} stroke="#1a2f52" strokeWidth={0.6 * s} />
      ))}
      {[-60, -30, 0, 30, 60].map((y) => (
        <line key={`h${y}`} x1={-540} x2={540} y1={y} y2={y} stroke="#1a2f52" strokeWidth={0.6 * s} />
      ))}
      {landD && <path d={landD} fill="#17305a" stroke="#3a5f95" strokeWidth={0.5 * s} />}
      <path d={toD(route)} fill="none" stroke="#66B3FF" strokeOpacity={0.85} strokeWidth={1.6 * s} strokeDasharray={`${3 * s} ${3 * s}`} />
      <path d={toD(flown)} fill="none" stroke="#EBC77B" strokeWidth={2.6 * s} strokeLinecap="round" />
      <circle cx={route[0][0]} cy={-route[0][1]} r={4 * s} fill="#66B3FF" />
      <circle cx={end[0]} cy={-end[1]} r={4 * s} fill="#EBC77B" />
      <text x={route[0][0]} y={-route[0][1] - 8 * s} textAnchor="middle" fontSize={11 * s} fill="#F6F8FF" fontWeight={700} style={{ fontFamily: "var(--font-mono)" }}>
        {originCode}
      </text>
      <text x={end[0]} y={-end[1] - 8 * s} textAnchor="middle" fontSize={11 * s} fill="#F6F8FF" fontWeight={700} style={{ fontFamily: "var(--font-mono)" }}>
        {destinationCode}
      </text>
      <g transform={`translate(${planeX + shiftOf} ${-planeY}) rotate(${rotation}) scale(${0.85 * s}) translate(-12 -12)`}>
        <path d={PLANE_PATH} fill="#F6F8FF" stroke="#07101F" strokeWidth={0.6} />
      </g>
    </svg>
  );
}
