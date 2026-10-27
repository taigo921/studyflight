"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { IconSearch } from "@/components/icons/Icons";
import { airportCodeOf, airportDisplayName, normalizeQuery } from "@/domain/airport-search";
import { countryName, formatKm } from "@/domain/format";
import { destinationCandidates, type Candidate } from "@/domain/route-planner";
import type { Airport } from "@/domain/types";

const PAGE = 12;

/** 現在地から、学習時間で飛べる空港を候補として並べる。 */
export function DestinationPicker({
  origin,
  minutes,
  airports,
  visited,
  value,
  onChange,
}: {
  origin: Airport;
  minutes: number;
  airports: Airport[];
  visited: Set<string>;
  value: Airport | null;
  onChange: (a: Airport) => void;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const q = normalizeQuery(useDeferredValue(query));

  const candidates = useMemo(() => destinationCandidates(origin, minutes, airports), [origin, minutes, airports]);
  const filtered = candidates.filter((c) => {
    if (!q) return true;
    const a = c.airport;
    return normalizeQuery([a.iata, a.icao, a.name, a.nameJa, a.municipality, a.keywords, countryName(a.countryCode)].filter(Boolean).join(" ")).includes(q);
  });

  return (
    <div className="flex flex-col gap-3">
      {candidates.length > 6 && (
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-night/60 px-3 focus-within:border-sky">
          <IconSearch size={18} className="text-mute" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="候補を絞り込む（都市名・国・コード）"
            aria-label="行き先の候補を絞り込む"
            className="min-h-10 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute/60"
          />
        </label>
      )}
      <ul role="radiogroup" aria-label="行き先の候補" className="flex flex-col gap-2">
        {filtered.slice(0, shown).map((c) => (
          <CandidateRow key={c.airport.id} c={c} selected={value?.id === c.airport.id} firstVisit={!visited.has(c.airport.id)} onPick={onChange} />
        ))}
      </ul>
      {filtered.length === 0 && <p className="py-4 text-center text-sm text-mute">条件に合う空港がありません</p>}
      {filtered.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-11 rounded-2xl text-sm font-semibold text-sky">
          ほかの候補を見る（残り {filtered.length - shown}）
        </button>
      )}
    </div>
  );
}

function CandidateRow({ c, selected, firstVisit, onPick }: { c: Candidate; selected: boolean; firstVisit: boolean; onPick: (a: Airport) => void }) {
  const a = c.airport;
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onPick(a)}
        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
          selected ? "border-sky bg-sky/10" : "border-line/70 bg-night/50 hover:border-sky/50"
        }`}
      >
        <span className={`tabular w-12 shrink-0 text-lg font-bold tracking-wide ${selected ? "text-sky" : "text-ink"}`}>{airportCodeOf(a)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{airportDisplayName(a)}</span>
            {firstVisit && <span className="shrink-0 rounded-full border border-gold/50 px-1.5 text-[10px] font-semibold text-gold">初訪問</span>}
          </span>
          <span className="block truncate text-xs text-mute">{[a.municipality, countryName(a.countryCode)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="tabular shrink-0 text-right text-xs text-mute">
          <span className="block font-semibold text-ink">約{Math.round(c.flightMinutes)}分</span>
          {formatKm(c.distanceKm)}
        </span>
      </button>
    </li>
  );
}
