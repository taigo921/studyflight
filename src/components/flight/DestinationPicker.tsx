"use client";

// 行き先候補のリスト（時間に合う便 / 分割して飛ぶ便）。絞り込み検索つき。
import { useDeferredValue, useState } from "react";
import { CandidateRow } from "@/components/boarding/FlightCandidateViews";
import { IconSearch } from "@/components/icons/Icons";
import { normalizeQuery } from "@/domain/airport-search";
import { countryName } from "@/domain/format";
import type { FlightCandidate, SearchResult } from "@/domain/route-search";
import type { Airport } from "@/domain/types";

const PAGE = 15;

function Section({ title, note, items, value, visited, onChange }: { title: string; note?: string; items: FlightCandidate[]; value: Airport | null; visited: Set<string>; onChange: (c: FlightCandidate) => void }) {
  const [shown, setShown] = useState(PAGE);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h3 className="text-sm font-bold">
          {title} <span className="text-xs font-normal text-mute">{items.length}件</span>
        </h3>
        {note && <p className="text-xs text-mute">{note}</p>}
      </div>
      <ul role="radiogroup" aria-label={title} className="flex flex-col gap-2">
        {items.slice(0, shown).map((c) => (
          <CandidateRow key={c.airport.id} c={c} selected={value?.id === c.airport.id} firstVisit={!visited.has(c.airport.id)} onPick={() => onChange(c)} />
        ))}
      </ul>
      {items.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="min-h-11 rounded-2xl text-sm font-semibold text-sky">
          さらに表示（残り {items.length - shown}）
        </button>
      )}
    </section>
  );
}

export function DestinationPicker({ result, studyMinutes, visited, value, onChange }: { result: SearchResult; studyMinutes: number; visited: Set<string>; value: Airport | null; onChange: (c: FlightCandidate) => void }) {
  const [query, setQuery] = useState("");
  const q = normalizeQuery(useDeferredValue(query));
  const match = (c: FlightCandidate) => {
    if (!q) return true;
    const a = c.airport;
    return normalizeQuery([a.iata, a.icao, a.name, a.nameJa, a.municipality, a.keywords, countryName(a.countryCode), c.carriers.join(" ")].filter(Boolean).join(" ")).includes(q);
  };
  return (
    <div className="flex flex-col gap-5">
      <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-night/60 px-3 focus-within:border-sky">
        <IconSearch size={18} className="text-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="都市名・国・空港コード・航空会社で絞り込む"
          aria-label="行き先の候補を絞り込む"
          className="min-h-10 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute/60 focus-visible:outline-none"
        />
      </label>
      <Section title="時間に合う便" items={result.fit.filter(match)} value={value} visited={visited} onChange={onChange} />
      <Section
        title="分割して飛ぶ便"
        note={`予定飛行時間が長い便は、${studyMinutes}分ずつ何回かに分けて飛びます。途中で終えても、次回は同じ地点から再開できます。`}
        items={result.longer.filter(match)}
        value={value}
        visited={visited}
        onChange={onChange}
      />
      <Section title="短い便" note="学習時間より早く着く便です。到着した時点でその回の学習が終わります。" items={result.shorter.filter(match)} value={value} visited={visited} onChange={onChange} />
      <p className="px-1 text-[11px] text-mute/80">
        直行便実績: OpenFlights 路線データ（ODbL, 2014年時点。現在の運航とは異なる場合があります）。予定飛行時間は距離からの推定値で、実際の時刻表とは異なります。
      </p>
    </div>
  );
}
