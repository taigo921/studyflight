"use client";

import { useState } from "react";
import { formatDuration } from "@/domain/format";

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

/** 曜日×時間帯の集中時間（単一色相の濃淡）。 */
export function HourHeatmap({ grid }: { grid: number[][] }) {
  const [active, setActive] = useState<[number, number] | null>(null);
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((a, b) => a + b, 0);
  let peak: [number, number] = [0, 0];
  grid.forEach((row, d) => row.forEach((v, h) => v > grid[peak[0]][peak[1]] && (peak = [d, h])));
  if (total === 0) return <p className="py-6 text-center text-sm text-mute">記録が増えると、集中しやすい時間帯が見えてきます</p>;
  const a = active ? grid[active[0]][active[1]] : null;
  return (
    <div>
      <p className="mb-3 text-sm text-mute">
        いちばん集中しているのは <span className="font-semibold text-ink">{DAYS[peak[0]]}曜 {peak[1]}時台</span>
      </p>
      <div className="grid grid-cols-[18px_1fr] gap-x-1.5 gap-y-[3px]" role="img" aria-label="曜日と時間帯ごとの集中時間のヒートマップ">
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="text-[10px] leading-[14px] text-mute">{DAYS[d]}</span>
            <div className="grid grid-cols-24 gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {row.map((v, h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={`${DAYS[d]}曜 ${h}時台 ${formatDuration(v)}`}
                  onClick={() => setActive(active && active[0] === d && active[1] === h ? null : [d, h])}
                  onMouseEnter={() => setActive([d, h])}
                  className="h-[14px] rounded-[3px]"
                  style={{
                    background: v === 0 ? "var(--color-elevated)" : `rgba(102,179,255,${0.18 + 0.82 * (v / max)})`,
                    outline: active && active[0] === d && active[1] === h ? "1.5px solid var(--color-ink)" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <span />
        <div className="tabular flex justify-between text-[10px] text-mute">
          <span>0時</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </div>
      <p className="mt-2 min-h-5 text-xs text-mute" aria-live="polite">
        {active && a !== null ? `${DAYS[active[0]]}曜 ${active[1]}時台: ${formatDuration(a)}（累計）` : "マスをタップすると時間を表示します"}
      </p>
    </div>
  );
}
