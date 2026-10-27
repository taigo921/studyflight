"use client";

import { useState } from "react";
import { MAX_PLANNED_MINUTES, MIN_PLANNED_MINUTES, validatePlannedMinutes } from "@/domain/session";

const PRESETS = [25, 45, 60, 90];

/** onChange には有効な分数、またはカスタム入力が不正なとき null を渡す。 */
export function DurationPicker({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
  const [custom, setCustom] = useState(value === null || PRESETS.includes(value) ? "" : String(value));
  const isCustom = custom !== "";
  const error = custom !== "" ? validatePlannedMinutes(Number(custom)) : null;

  return (
    <div>
      <div role="radiogroup" aria-label="集中時間" className="grid grid-cols-4 gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m && custom === ""}
            onClick={() => {
              setCustom("");
              onChange(m);
            }}
            className={`tabular min-h-12 rounded-2xl border text-[17px] font-bold transition-colors ${
              value === m && custom === "" ? "border-sky bg-sky/15 text-sky" : "border-line bg-night/60 text-ink hover:border-sky/50"
            }`}
          >
            {m}
            <span className="ml-0.5 text-xs font-medium">分</span>
          </button>
        ))}
      </div>
      <label className={`mt-2 flex min-h-12 items-center gap-2 rounded-2xl border px-4 ${error ? "border-danger" : isCustom && custom ? "border-sky" : "border-line"} bg-night/60`}>
        <span className="text-sm text-mute">カスタム</span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_PLANNED_MINUTES}
          max={MAX_PLANNED_MINUTES}
          step={1}
          value={custom}
          placeholder={`${MIN_PLANNED_MINUTES}〜${MAX_PLANNED_MINUTES}`}
          aria-label="カスタム時間（分）"
          aria-invalid={!!error}
          aria-describedby="duration-error"
          onChange={(e) => {
            setCustom(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value === "") onChange(25);
            else onChange(validatePlannedMinutes(n) ? null : n);
          }}
          className="tabular min-h-11 flex-1 bg-transparent text-right text-ink outline-none placeholder:text-mute/60"
        />
        <span className="text-sm text-mute">分</span>
      </label>
      {error && (
        <p id="duration-error" className="mt-1 px-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
