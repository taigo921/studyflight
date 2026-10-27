"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { IconSearch } from "@/components/icons/Icons";
import { Sheet } from "@/components/ui/Sheet";
import { airportCodeOf, airportDisplayName, searchAirports } from "@/domain/airport-search";
import { countryName } from "@/domain/format";
import type { Airport } from "@/domain/types";

function AirportRow({ a, onPick, selected }: { a: Airport; onPick: (a: Airport) => void; selected?: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => onPick(a)}
        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-elevated ${selected ? "bg-elevated" : ""}`}
      >
        <span className="tabular w-12 shrink-0 text-lg font-bold tracking-wide text-sky">{airportCodeOf(a)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{airportDisplayName(a)}</span>
          <span className="block truncate text-xs text-mute">
            {[a.municipality, countryName(a.countryCode)].filter(Boolean).join(" · ")}
            {a.nameJa ? ` · ${a.name}` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

export function AirportCombobox({
  label,
  value,
  onChange,
  airports,
  recent,
  suggested,
  exclude,
}: {
  label: string;
  value: Airport | null;
  onChange: (a: Airport) => void;
  airports: Airport[];
  recent: Airport[];
  suggested: Airport[];
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchAirports(airports, deferred, 30).filter((a) => a.id !== exclude), [airports, deferred, exclude]);

  const pick = (a: Airport) => {
    onChange(a);
    setOpen(false);
    setQuery("");
  };

  const list = (items: Airport[]) => (
    <ul role="listbox" aria-label={`${label}の候補`} className="flex flex-col gap-0.5">
      {items.map((a) => (
        <AirportRow key={a.id} a={a} onPick={pick} selected={a.id === value?.id} />
      ))}
    </ul>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${label}空港を選択${value ? `（現在: ${airportCodeOf(value)} ${airportDisplayName(value)}）` : ""}`}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-night/60 px-4 py-2 text-left transition-colors hover:border-sky/60"
      >
        <span className="w-12 shrink-0">
          <span className="block text-[10px] font-semibold tracking-[0.14em] text-mute uppercase">{label}</span>
          <span className="tabular block text-xl font-bold text-ink">{value ? airportCodeOf(value) : "---"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${value ? "" : "text-mute"}`}>{value ? airportDisplayName(value) : "空港を検索"}</span>
          {value && <span className="block truncate text-xs text-mute">{[value.municipality, countryName(value.countryCode)].filter(Boolean).join(" · ")}</span>}
        </span>
        <IconSearch className="shrink-0 text-mute" size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${label}を選択`}>
        <label className="sticky top-0 z-10 mb-3 flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-night px-3 focus-within:border-sky">
          <IconSearch size={20} className="text-mute" />
          <span className="sr-only">空港を検索</span>
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="HND、成田、London など"
            className="min-h-11 flex-1 bg-transparent text-ink outline-none placeholder:text-mute/70"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            enterKeyHint="search"
            type="search"
          />
        </label>
        {query.trim() ? (
          results.length > 0 ? (
            list(results)
          ) : (
            <p className="py-8 text-center text-sm text-mute">「{query}」に一致する空港はありません</p>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {recent.length > 0 && (
              <div>
                <p className="mb-1 px-1 text-xs font-semibold text-mute">最近使った空港</p>
                {list(recent.filter((a) => a.id !== exclude))}
              </div>
            )}
            <div>
              <p className="mb-1 px-1 text-xs font-semibold text-mute">おすすめ</p>
              {list(suggested.filter((a) => a.id !== exclude))}
            </div>
          </div>
        )}
        <p className="mt-4 text-[11px] text-mute/80">空港データ: OurAirports（パブリックドメイン）</p>
      </Sheet>
    </>
  );
}
