"use client";

// 行き先候補の表示部品。直行便の就航実績（OpenFlights）と推定ルートを必ず区別して表示する。
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { countryName, formatKm } from "@/domain/format";
import type { FlightCandidate } from "@/domain/route-search";

export function SourceBadge({ c, compact = false }: { c: Pick<FlightCandidate, "source" | "carriers">; compact?: boolean }) {
  if (c.source === "route")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky/50 bg-sky/10 px-1.5 text-[10px] font-semibold text-sky" title="OpenFlights の路線データ（2014年時点）に直行便の就航実績があります">
        直行便実績{!compact && c.carriers.length > 0 && <span className="font-normal text-sky/80">· {c.carriers.slice(0, 3).join(" ")}</span>}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-mute/60 px-1.5 text-[10px] font-semibold text-mute" title="路線データに直行便がない空港間です。距離からの推定です">
      推定ルート
    </span>
  );
}

export function FinalProgress({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return <span className={`tabular text-[11px] font-semibold ${pct >= 0 ? "text-ok" : "text-danger"}`}>{pct >= 0 ? `目的地へ +${pct}%` : `目的地から ${pct}%`}</span>;
}

/** 横スクロール用の小さなカード */
export function CandidateCard({ c, selected, firstVisit, onPick }: { c: FlightCandidate; selected: boolean; firstVisit: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-airport={c.airport.id}
      onClick={onPick}
      className={`w-[150px] shrink-0 snap-center rounded-2xl border p-3 text-left transition-colors ${selected ? "border-gold bg-gold/15" : "border-line bg-surface/80"}`}
    >
      <span className="flex items-center justify-between gap-1">
        <span className={`tabular text-lg font-bold tracking-wide ${selected ? "text-gold" : "text-ink"}`}>{airportCodeOf(c.airport)}</span>
        {firstVisit && <span className="rounded-full border border-gold/50 px-1.5 text-[9px] font-semibold text-gold">初</span>}
      </span>
      <span className="mt-0.5 block truncate text-xs font-semibold">{c.airport.nameJa ?? c.airport.municipality ?? c.airport.name}</span>
      <span className="tabular block text-[11px] text-mute">
        約{c.blockMinutes}分（推定）· {formatKm(c.distanceKm)}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <SourceBadge c={c} compact />
        {c.sessions > 1 && <span className="rounded-full bg-gold/15 px-1.5 text-[10px] font-semibold text-gold">{c.sessions}回で到着</span>}
      </span>
      <FinalProgress value={c.finalProgress} />
    </button>
  );
}

/** リスト用の行 */
export function CandidateRow({ c, selected, firstVisit, onPick }: { c: FlightCandidate; selected: boolean; firstVisit: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onPick}
        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${selected ? "border-sky bg-sky/10" : "border-line/70 bg-night/50 hover:border-sky/50"}`}
      >
        <span className={`tabular w-12 shrink-0 text-lg font-bold tracking-wide ${selected ? "text-sky" : "text-ink"}`}>{airportCodeOf(c.airport)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{airportDisplayName(c.airport)}</span>
            {firstVisit && <span className="shrink-0 rounded-full border border-gold/50 px-1.5 text-[10px] font-semibold text-gold">初訪問</span>}
          </span>
          <span className="block truncate text-xs text-mute">{[c.airport.municipality, countryName(c.airport.countryCode)].filter(Boolean).join(" · ")}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <SourceBadge c={c} />
            <FinalProgress value={c.finalProgress} />
          </span>
        </span>
        <span className="tabular shrink-0 text-right text-xs text-mute">
          <span className="block font-semibold text-ink">約{c.blockMinutes}分</span>
          <span className="block text-[10px]">推定</span>
          {formatKm(c.distanceKm)}
          {c.sessions > 1 && <span className="block text-[11px] font-semibold text-gold">{c.sessions}回で到着</span>}
        </span>
      </button>
    </li>
  );
}
