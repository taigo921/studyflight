"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FlightStub } from "@/components/flight/FlightStub";
import { IconLog, IconSearch } from "@/components/icons/Icons";
import { EmptyState } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { formatDuration } from "@/domain/format";
import { normalizeQuery } from "@/domain/airport-search";
import { addDays, dayKey } from "@/domain/zoned";
import { useGoals, useSessions, useSubjects } from "@/features/data-hooks";
import { useNow } from "@/features/useNow";
import { SessionDetailSheet } from "./SessionDetailSheet";

type Range = "all" | "today" | "7d" | "30d";

export function LogScreen() {
  const router = useRouter();
  const selectedId = useSearchParams().get("id");
  const sessions = useSessions();
  const subjects = useSubjects(true);
  const { timezone } = useGoals();
  const now = useNow(60_000);
  const [range, setRange] = useState<Range>("all");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [showAbandoned, setShowAbandoned] = useState(true);
  const [query, setQuery] = useState("");

  const today = dayKey(now, timezone);
  const filtered = useMemo(() => {
    if (!sessions) return [];
    const from = range === "today" ? today : range === "7d" ? addDays(today, -6) : range === "30d" ? addDays(today, -29) : null;
    const q = normalizeQuery(query);
    return sessions.filter((s) => {
      if (!showAbandoned && s.status === "abandoned") return false;
      if (subjectId !== "all" && s.subjectId !== subjectId) return false;
      if (from && dayKey(Date.parse(s.startedAt ?? s.createdAt), timezone) < from) return false;
      if (q) {
        const hay = normalizeQuery([s.subjectName, s.taskTitle, s.note, s.originCode, s.destinationCode].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, range, subjectId, showAbandoned, query, today, timezone]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const key = dayKey(Date.parse(s.startedAt ?? s.createdAt), timezone);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [filtered, timezone]);

  const selected = sessions?.find((s) => s.id === selectedId) ?? null;
  const usedSubjects = subjects?.filter((sub) => sessions?.some((s) => s.subjectId === sub.id)) ?? [];

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="フライトログ" subtitle={sessions ? `${sessions.filter((s) => s.status === "completed").length} 便の記録` : " "} />
      <div className="mb-4 flex flex-col gap-3">
        <Segmented<Range>
          label="期間"
          value={range}
          onChange={setRange}
          options={[
            { value: "all", label: "すべて" },
            { value: "today", label: "今日" },
            { value: "7d", label: "7日" },
            { value: "30d", label: "30日" },
          ]}
        />
        <div className="flex gap-2">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-sky">
            <IconSearch size={18} className="text-mute" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="メモ・タスク・空港で検索"
              aria-label="ログを検索"
              className="min-h-10 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute/60 focus-visible:outline-none"
            />
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="科目で絞り込み"
            className="min-h-11 max-w-[40%] rounded-2xl border border-line bg-surface px-3 text-ink"
          >
            <option value="all">全科目</option>
            {usedSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 self-start text-sm text-mute">
          <input type="checkbox" checked={showAbandoned} onChange={(e) => setShowAbandoned(e.target.checked)} className="size-5 accent-sky" />
          欠航（集計対象外）も表示
        </label>
      </div>

      {sessions && groups.length === 0 && (
        <EmptyState icon={<IconLog size={28} />} title={sessions.length === 0 ? "まだ記録がありません" : "条件に一致する記録はありません"}>
          {sessions.length === 0 ? "フライトを完了すると、ここに搭乗記録が残ります。" : "絞り込み条件を変更してください。"}
        </EmptyState>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(([day, list]) => {
          const total = list.filter((s) => s.status === "completed").reduce((a, s) => a + (s.actualFocusSeconds ?? 0), 0);
          const label = new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${day}T00:00:00Z`));
          return (
            <section key={day} aria-label={label}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{day === today ? "今日" : label}</h2>
                <span className="tabular text-xs text-mute">{formatDuration(total)}</span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {list.map((s) => (
                  <li key={s.id}>
                    <FlightStub session={s} timezone={timezone} onClick={() => router.push(`/log/?id=${s.id}`, { scroll: false })} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {selected && <SessionDetailSheet key={selected.id} session={selected} timezone={timezone} onClose={() => router.replace("/log/", { scroll: false })} />}
    </main>
  );
}
