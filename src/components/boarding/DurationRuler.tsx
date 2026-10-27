"use client";

// 学習時間を選ぶ目盛り（横スクロール）。5分刻み、5〜240分。
import { useEffect, useRef, type KeyboardEvent } from "react";
import { MAX_PLANNED_MINUTES, MIN_PLANNED_MINUTES } from "@/domain/session";

const STEP = 5;
const PX = 14; // 5分あたりの幅

export function DurationRuler({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);
  const count = (MAX_PLANNED_MINUTES - MIN_PLANNED_MINUTES) / STEP + 1;

  // 値に合わせて目盛りを移動
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = ((value - MIN_PLANNED_MINUTES) / STEP) * PX;
    if (Math.abs(el.scrollLeft - target) > PX / 2) {
      programmatic.current = true;
      el.scrollTo({ left: target });
      setTimeout(() => (programmatic.current = false), 80);
    }
  }, [value]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const m = MIN_PLANNED_MINUTES + Math.round(el.scrollLeft / PX) * STEP;
      const clamped = Math.min(MAX_PLANNED_MINUTES, Math.max(MIN_PLANNED_MINUTES, m));
      if (clamped !== value) onChange(clamped);
    }, 90);
  };

  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? STEP : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -STEP : 0;
    if (!d) return;
    e.preventDefault();
    onChange(Math.min(MAX_PLANNED_MINUTES, Math.max(MIN_PLANNED_MINUTES, value + d)));
  };

  return (
    <div className="relative select-none">
      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 text-gold" aria-hidden>
        <svg width="14" height="10" viewBox="0 0 14 10">
          <path d="M0 0h14L7 10Z" fill="currentColor" />
        </svg>
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        onKeyDown={onKey}
        tabIndex={0}
        role="slider"
        aria-label="集中する時間"
        aria-valuemin={MIN_PLANNED_MINUTES}
        aria-valuemax={MAX_PLANNED_MINUTES}
        aria-valuenow={value}
        aria-valuetext={`${value}分`}
        className="no-scrollbar overflow-x-auto overscroll-contain pt-3"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        <div className="flex items-start" style={{ paddingInline: "calc(50% - 0.5px)", width: "max-content" }}>
          {Array.from({ length: count }, (_, i) => {
            const m = MIN_PLANNED_MINUTES + i * STEP;
            const major = m % 30 === 0;
            const mid = m % 15 === 0;
            return (
              <div key={m} className="relative flex flex-col items-center" style={{ width: PX, marginLeft: i === 0 ? -PX / 2 : 0, scrollSnapAlign: "center" }}>
                <span className={`block w-px rounded ${major ? "h-6 bg-ink" : mid ? "h-4 bg-mute" : "h-3 bg-mute/50"}`} />
                {major && <span className="tabular absolute top-7 text-[11px] whitespace-nowrap text-mute">{m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`}</span>}
              </div>
            );
          })}
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}
