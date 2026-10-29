"use client";

// 客室の座席表（上から見た機体）。StudyFlight 独自のデザイン。
import { useMemo } from "react";

const LEFT = ["A", "B", "C"];
const RIGHT = ["D", "E", "F"];
const ROWS = 24;

/** その日ごとに決まる「埋まっている席」（演出）。 */
function occupiedSeats(seed: string): Set<string> {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const taken = new Set<string>();
  for (let r = 1; r <= ROWS; r++) {
    for (const c of [...LEFT, ...RIGHT]) {
      h = Math.imul(h ^ (r * 31 + c.charCodeAt(0)), 16777619) >>> 0;
      if (h % 100 < 34) taken.add(`${r}${c}`);
    }
  }
  return taken;
}

export function seatKind(seat: string): string {
  const c = seat.slice(-1);
  return c === "A" || c === "F" ? "窓側" : c === "C" || c === "D" ? "通路側" : "中央";
}

/**
 * friends: 同乗フライトで友達が座っている席（席 → 名前）。指定すると演出の「使用中」の代わりに友達の席だけを埋める。
 */
export function SeatMap({ value, onPick, seed, friends }: { value: string | null; onPick: (seat: string) => void; seed: string; friends?: Map<string, string> }) {
  const taken = useMemo(() => (friends ? new Set(friends.keys()) : occupiedSeats(seed)), [seed, friends]);
  const seat = (id: string) => {
    const busy = taken.has(id) && id !== value;
    const selected = id === value;
    const friend = friends?.get(id);
    return (
      <button
        key={id}
        type="button"
        disabled={busy}
        onClick={() => onPick(id)}
        aria-pressed={selected}
        aria-label={`座席 ${id}（${seatKind(id)}）${friend && id !== value ? `・${friend}` : busy ? "・使用中" : ""}`}
        className={`relative h-11 w-full rounded-t-[12px] rounded-b-md border transition-colors ${
          selected ? "border-gold bg-gold text-night" : friend ? "border-ok/60 bg-ok/20 text-ok" : busy ? "border-transparent bg-white/5" : "border-sky/30 bg-sky/10 hover:border-sky hover:bg-sky/25"
        }`}
      >
        {friend && !selected && <span className="text-[12px] font-bold">{[...friend][0]}</span>}
        <span className={`absolute inset-x-1.5 bottom-1 h-1.5 rounded-sm ${selected ? "bg-night/30" : busy ? "bg-white/5" : "bg-sky/30"}`} aria-hidden />
        {selected && <span className="tabular text-[11px] font-bold">{id}</span>}
      </button>
    );
  };
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* 機首 */}
      <svg viewBox="0 0 380 210" className="block w-full" aria-hidden>
        <defs>
          <linearGradient id="fuselage" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#13213a" />
            <stop offset="0.5" stopColor="#1b2d4d" />
            <stop offset="1" stopColor="#13213a" />
          </linearGradient>
        </defs>
        <path d="M14 210 C 14 110, 110 8, 190 8 C 270 8, 366 110, 366 210 Z" fill="url(#fuselage)" stroke="#2b3b55" strokeWidth="2" />
        {[-54, -18, 18, 54].map((x, i) => (
          <path key={i} d={`M${190 + x - 15} 92 L${190 + x + 15} 92 L${190 + x + 12} 72 L${190 + x - 12} 72 Z`} fill="#0b1426" stroke="#3a5f95" strokeWidth="1.5" transform={`rotate(${x / 6} ${190 + x} 82)`} />
        ))}
        <path d="M110 150 H270" stroke="#EBC77B" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="2 6" />
        <text x="190" y="190" textAnchor="middle" fill="#A4B3CC" fontSize="13" letterSpacing="4">
          STUDYFLIGHT
        </text>
      </svg>
      {/* 客室 */}
      <div className="-mt-px rounded-b-[40px] border-x-2 border-b-2 border-line bg-gradient-to-r from-[#13213a] via-[#1b2d4d] to-[#13213a] px-4 pt-2 pb-10">
        <div className="tabular mb-2 grid grid-cols-[repeat(3,minmax(0,1fr))_28px_repeat(3,minmax(0,1fr))] gap-1.5 text-center text-xs text-mute">
          {LEFT.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span />
          {RIGHT.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: ROWS }, (_, i) => i + 1).map((r) => (
            <div key={r} className="grid grid-cols-[repeat(3,minmax(0,1fr))_28px_repeat(3,minmax(0,1fr))] items-center gap-1.5">
              {LEFT.map((c) => seat(`${r}${c}`))}
              <span className="tabular text-center text-[11px] text-mute">{r}</span>
              {RIGHT.map((c) => seat(`${r}${c}`))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
