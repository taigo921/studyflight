"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { MapStyleId } from "@/domain/types";
import { MAP_STYLE_LABELS, mapCredits } from "@/lib/map-styles";

const SWATCH: Record<MapStyleId, string> = {
  satellite: "radial-gradient(circle at 30% 30%, #6d7f45, #3b4a2a 45%, #1e3550 70%, #0f2238)",
  standard: "linear-gradient(135deg, #e9e5da 0 55%, #a9cbe6 55%)",
  dark: "linear-gradient(135deg, #2a2d33 0 55%, #15171b 55%)",
  globe: "radial-gradient(circle at 50% 120%, #17305a 0 55%, #0a1830 56%)",
};

export function MapStyleSheet({ open, onClose, value, labels, onChange, onLabels }: { open: boolean; onClose: () => void; value: MapStyleId; labels: boolean; onChange: (v: MapStyleId) => void; onLabels: (v: boolean) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="地図の見た目">
      <div role="radiogroup" aria-label="地図の見た目" className="grid grid-cols-2 gap-3">
        {(Object.keys(MAP_STYLE_LABELS) as MapStyleId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className={`relative h-24 overflow-hidden rounded-2xl border-2 text-left ${value === id ? "border-gold" : "border-line"}`}
            style={{ background: SWATCH[id] }}
          >
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-sm font-semibold text-white">{MAP_STYLE_LABELS[id]}</span>
          </button>
        ))}
      </div>
      <label className="mt-4 flex min-h-12 items-center justify-between rounded-2xl border border-line px-4">
        <span>地名ラベル</span>
        <input type="checkbox" role="switch" checked={labels} onChange={(e) => onLabels(e.target.checked)} className="size-5 accent-sky" />
      </label>
      <p className="mt-3 text-xs text-mute">衛星写真・標準・ダークは通信が必要です。オフラインでは「地球」を選ぶと表示できます。</p>
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-1 text-xs font-semibold text-mute">地図の出典</p>
        <ul className="flex flex-col gap-1 text-xs text-mute">
          {mapCredits(value).map((c) => (
            <li key={c.label}>
              <a href={c.href} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2">
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
