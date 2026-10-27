"use client";

/** ± ボタン付きの数値入力。大きなタッチ領域で片手でも操作しやすい。 */
export function Stepper({ label, value, onChange, min, max, step, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-night/60 p-1">
        <button type="button" aria-label={`${label}を減らす`} onClick={() => onChange(clamp(value - step))} disabled={value <= min} className="size-10 rounded-xl text-lg text-sky disabled:opacity-30">
          −
        </button>
        <label className="flex items-baseline gap-0.5">
          <span className="sr-only">{label}</span>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            onChange={(e) => e.target.value !== "" && onChange(clamp(Number(e.target.value)))}
            className="tabular w-14 bg-transparent text-center font-bold text-ink outline-none"
          />
          <span className="text-xs text-mute">{unit}</span>
        </label>
        <button type="button" aria-label={`${label}を増やす`} onClick={() => onChange(clamp(value + step))} disabled={value >= max} className="size-10 rounded-xl text-lg text-sky disabled:opacity-30">
          +
        </button>
      </div>
    </div>
  );
}
