import type { ReactNode } from "react";

export function StatTile({ label, value, unit, hint, accent }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-surface/80 p-4">
      <p className="text-xs text-mute">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-mute">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}
