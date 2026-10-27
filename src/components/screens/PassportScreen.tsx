"use client";

import { useMemo } from "react";
import { IconCheck, IconPassport, IconStar } from "@/components/icons/Icons";
import { PassportMap } from "@/components/passport/PassportMap";
import { Card, EmptyState, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { StatTile } from "@/components/ui/StatTile";
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { countryName, formatKm, formatPoints } from "@/domain/format";
import type { LngLat } from "@/domain/geo";
import { arrivalAirportId, arrivalCode } from "@/domain/route-planner";
import { RANKS } from "@/domain/scoring";
import { usePreferences } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { useNow } from "@/features/useNow";
import { useStats } from "@/features/useStats";

export function PassportScreen() {
  const stats = useStats(useNow(60_000));
  const prefs = usePreferences();
  const { byId } = useAirports();

  const visited = useMemo(() => {
    if (!stats) return [];
    return [...stats.visited.entries()]
      .map(([id, v]) => ({ id, ...v, airport: byId.get(id) }))
      .sort((a, b) => b.firstVisitedAt.localeCompare(a.firstVisitedAt));
  }, [stats, byId]);

  const routes = useMemo(() => {
    if (!stats) return [] as { key: string; label: string; count: number; km: number; a: LngLat | null; b: LngLat | null }[];
    const map = new Map<string, { key: string; label: string; count: number; km: number; a: LngLat | null; b: LngLat | null }>();
    for (const s of stats.sessions) {
      if (s.status !== "completed") continue;
      const to = arrivalAirportId(s);
      if (!to) continue; // 上空で止まった回は航路ログに含めない
      const key = `${s.originAirportId}>${to}`;
      const o = byId.get(s.originAirportId);
      const d = byId.get(to);
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { key, label: `${s.originCode} → ${arrivalCode(s)}`, count: 1, km: s.routeDistanceKm ?? s.distanceKm, a: o ? [o.lng, o.lat] : null, b: d ? [d.lng, d.lat] : null });
    }
    return [...map.values()].sort((x, y) => y.count - x.count);
  }, [stats, byId]);

  if (!stats) return <main className="min-h-dvh" aria-busy="true" />;
  const { rank, next, progressToNext } = stats.rank;

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="パスポート" subtitle={prefs.displayName ? `${prefs.displayName} さんの旅の記録` : "旅の記録"} />
      <div className="flex flex-col gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#1b2a47] to-surface">
          <div className="absolute -top-10 -right-10 size-40 rounded-full border border-gold/20" aria-hidden />
          <div className="absolute -top-4 -right-4 size-28 rounded-full border border-gold/15" aria-hidden />
          <p className="text-[11px] font-bold tracking-[0.2em] text-gold">STUDYFLIGHT PASSPORT</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-mute">ランク</p>
              <p className="text-2xl font-bold">
                {rank.label} <span className="text-sm font-medium text-mute">{rank.labelJa}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-mute">SkyPoints</p>
              <p className="tabular text-2xl font-bold text-gold" data-testid="total-points">
                {formatPoints(stats.summary.totalPoints)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={progressToNext} color="var(--color-gold)" label="次のランクまでの進捗" />
            <p className="tabular mt-1.5 text-xs text-mute">{next ? `${next.label} まであと ${next.minPoints - stats.summary.totalPoints} SP` : "最高ランクに到達しました"}</p>
          </div>
          <ol className="mt-4 flex gap-1.5" aria-label="ランク一覧">
            {RANKS.map((r) => (
              <li key={r.id} className={`flex-1 rounded-lg border px-1.5 py-1 text-center text-[10px] ${stats.summary.totalPoints >= r.minPoints ? "border-gold/50 text-gold" : "border-line text-mute"}`}>
                {r.label}
                <span className="tabular block text-[9px] opacity-80">{r.minPoints}+</span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="訪問空港" value={stats.visited.size} />
          <StatTile label="国・地域" value={stats.countries.size} />
          <StatTile label="完了便" value={stats.summary.completedFlights} />
        </div>
        <StatTile label="総飛行距離（演出上の記録で、SkyPoints とは別の指標です）" value={formatKm(stats.summary.totalDistanceKm)} />

        <Card>
          <SectionTitle>訪れた場所</SectionTitle>
          <PassportMap
            airports={visited.filter((v) => v.airport).map((v) => ({ id: v.id, code: airportCodeOf(v.airport!), pos: [v.airport!.lng, v.airport!.lat] as LngLat }))}
            routes={routes.filter((r) => r.a && r.b).map((r) => [r.a!, r.b!] as [LngLat, LngLat])}
          />
          <p className="mt-2 text-[10px] text-mute/70">地図データ: Natural Earth（パブリックドメイン）</p>
        </Card>

        <section>
          <SectionTitle>入国スタンプ</SectionTitle>
          {visited.length === 0 ? (
            <EmptyState icon={<IconPassport size={28} />} title="まだスタンプがありません">
              フライトを完了すると、出発地と到着地のスタンプが押されます。
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {visited.map((v, i) => (
                <li
                  key={v.id}
                  className="rounded-2xl border border-dashed p-3"
                  style={{ borderColor: i % 2 ? "rgba(235,199,123,.45)" : "rgba(102,179,255,.45)", transform: `rotate(${((i * 37) % 5) - 2}deg)` }}
                >
                  <p className={`tabular text-xl font-bold tracking-wider ${i % 2 ? "text-gold" : "text-sky"}`}>{v.airport ? airportCodeOf(v.airport) : v.id}</p>
                  <p className="truncate text-xs">{v.airport ? airportDisplayName(v.airport) : v.id}</p>
                  <p className="truncate text-[11px] text-mute">
                    {v.airport ? countryName(v.airport.countryCode) : ""} · {v.visits}回
                  </p>
                  <p className="tabular text-[10px] text-mute/80">{new Intl.DateTimeFormat("ja-JP", { timeZone: stats.timezone, dateStyle: "medium" }).format(new Date(v.firstVisitedAt))}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>実績</SectionTitle>
          <ul className="grid grid-cols-1 gap-2">
            {stats.achievements.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${a.achieved ? "border-gold/40 bg-gold/5" : "border-line/70 bg-surface/60"}`}>
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${a.achieved ? "bg-gold/20 text-gold" : "bg-elevated text-mute"}`}>
                  {a.achieved ? <IconCheck size={20} /> : <IconStar size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {a.title}
                    <span className="sr-only">{a.achieved ? "（達成）" : "（未達成）"}</span>
                  </p>
                  <p className="text-xs text-mute">{a.description}</p>
                  {!a.achieved && (
                    <div className="mt-1.5">
                      <ProgressBar value={a.progress} label={`${a.title}の進捗`} />
                    </div>
                  )}
                </div>
                {a.achieved && <span className="text-xs font-semibold text-gold">達成</span>}
              </li>
            ))}
          </ul>
        </section>

        {routes.length > 0 && (
          <section>
            <SectionTitle>航路ログ</SectionTitle>
            <ul className="divide-y divide-line/50 rounded-2xl border border-line/70 bg-surface/60">
              {routes.map((r) => (
                <li key={r.key} className="tabular flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-semibold tracking-wide">{r.label}</span>
                  <span className="text-mute">
                    {formatKm(r.km)} · {r.count}回
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
