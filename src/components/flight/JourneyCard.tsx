"use client";

import { Fragment } from "react";
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { countryName } from "@/domain/format";
import { journeyTrail } from "@/domain/route-planner";
import type { Airport, FlightSession } from "@/domain/types";

const MAX_STOPS = 8;

/** 現在地と旅の軌跡（例: NGO → HND → CTS → OKA）。 */
export function JourneyCard({ current, sessions, byId }: { current: Airport | null; sessions: FlightSession[]; byId: Map<string, Airport> }) {
  const trail = journeyTrail(sessions);
  const shown = trail.slice(-MAX_STOPS);
  const code = (id: string) => {
    const a = byId.get(id);
    return a ? airportCodeOf(a) : id;
  };
  return (
    <section aria-label="現在地と旅の軌跡" className="rounded-3xl border border-line/70 bg-surface/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-mute">現在地</p>
          {current ? (
            <p className="truncate">
              <span className="tabular mr-2 text-xl font-bold text-gold">{airportCodeOf(current)}</span>
              <span className="text-sm">{airportDisplayName(current)}</span>
            </p>
          ) : (
            <p className="text-sm text-mute">最初のフライトで旅が始まります</p>
          )}
        </div>
        {current && <span className="shrink-0 text-xs text-mute">{countryName(current.countryCode)}</span>}
      </div>
      {trail.length > 1 && (
        <ol className="tabular mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm" aria-label="これまでの旅">
          {trail.length > MAX_STOPS && <li className="text-mute">…</li>}
          {shown.map((id, i) => (
            <Fragment key={`${id}-${i}`}>
              {i > 0 && (
                <li aria-hidden className={id === null || shown[i - 1] === null ? "text-transparent" : "text-sky"}>
                  →
                </li>
              )}
              {id === null ? (
                <li className="px-1 text-mute" aria-label="区切り">
                  /
                </li>
              ) : (
                <li className={`font-semibold ${i === shown.length - 1 ? "text-gold" : "text-ink"}`}>{code(id)}</li>
              )}
            </Fragment>
          ))}
        </ol>
      )}
    </section>
  );
}
