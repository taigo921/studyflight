"use client";

import { useState } from "react";
import { formatDayLabel, formatDuration } from "@/domain/format";

/**
 * 日別の集中時間（単一系列の棒グラフ）。目標値は破線の参照線。
 * タップ/ホバーで値を表示し、表での確認にも切り替えられる。
 */
export function DailyBarChart({ data, goalSeconds, today }: { data: { day: string; seconds: number }[]; goalSeconds: number; today: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = 340;
  const H = 168;
  const padL = 30;
  const padB = 22;
  const padT = 14;
  const max = Math.max(goalSeconds, ...data.map((d) => d.seconds), 60);
  const yMaxMin = Math.ceil(max / 60 / 30) * 30; // 30分刻み
  const yMax = yMaxMin * 60;
  const plotW = W - padL - 4;
  const plotH = H - padB - padT;
  const slot = plotW / data.length;
  const barW = Math.max(3, Math.min(22, slot - 2));
  const y = (s: number) => padT + plotH - (s / yMax) * plotH;
  const ticks = [0, yMaxMin / 2, yMaxMin];
  const labelEvery = data.length > 14 ? 5 : 1;

  if (asTable) {
    return (
      <div>
        <table className="w-full text-sm">
          <caption className="sr-only">日別の集中時間</caption>
          <thead>
            <tr className="text-left text-xs text-mute">
              <th className="py-1 font-medium">日付</th>
              <th className="py-1 text-right font-medium">集中時間</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {data.map((d) => (
              <tr key={d.day} className="border-t border-line/50">
                <td className="py-1.5">{formatDayLabel(d.day)}</td>
                <td className="py-1.5 text-right">{formatDuration(d.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => setAsTable(false)} className="mt-2 min-h-11 text-sm text-sky">
          グラフで見る
        </button>
      </div>
    );
  }

  const a = active !== null ? data[active] : null;
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`日別の集中時間。合計 ${formatDuration(data.reduce((s, d) => s + d.seconds, 0))}`} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y(t * 60)} y2={y(t * 60)} stroke="var(--color-line)" strokeOpacity={0.6} strokeWidth={1} />
              <text x={padL - 6} y={y(t * 60) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-mute)" className="tabular">
                {t >= 60 && t % 60 === 0 ? `${t / 60}h` : `${t}m`}
              </text>
            </g>
          ))}
          {goalSeconds > 0 && goalSeconds <= yMax && (
            <g>
              <line x1={padL} x2={W - 4} y1={y(goalSeconds)} y2={y(goalSeconds)} stroke="var(--color-gold)" strokeWidth={1.5} strokeDasharray="4 4" />
              <text x={W - 6} y={y(goalSeconds) - 4} textAnchor="end" fontSize={10} fill="var(--color-mute)">
                目標
              </text>
            </g>
          )}
          {data.map((d, i) => {
            const x = padL + i * slot + (slot - barW) / 2;
            const h = Math.max(0, padT + plotH - y(d.seconds));
            const r = Math.min(4, barW / 2, h);
            const top = padT + plotH - h;
            return (
              <g key={d.day}>
                {h > 0 && (
                  <path
                    d={`M${x},${padT + plotH}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${padT + plotH}Z`}
                    fill={d.day === today ? "var(--color-sky)" : "#3987e5"}
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={d.day === today ? "var(--color-ink)" : "var(--color-mute)"} className="tabular">
                    {formatDayLabel(d.day)}
                  </text>
                )}
                {/* 棒より広い当たり判定 */}
                <rect
                  x={padL + i * slot}
                  y={padT}
                  width={slot}
                  height={plotH + padB}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(active === i ? null : i)}
                  aria-label={`${formatDayLabel(d.day)} ${formatDuration(d.seconds)}`}
                />
              </g>
            );
          })}
        </svg>
        {a && active !== null && (
          <div
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-xl border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-lg"
            style={{ left: `${((padL + active * slot + slot / 2) / W) * 100}%` }}
          >
            <span className="text-mute">{formatDayLabel(a.day)}</span> <span className="tabular font-semibold text-ink">{formatDuration(a.seconds)}</span>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setAsTable(true)} className="min-h-11 text-sm text-sky">
        表で見る
      </button>
    </div>
  );
}
