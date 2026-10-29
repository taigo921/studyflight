"use client";

// フレンドの学習記録（本人が公開した要約）: 合計・直近14日・最近の便。
import { useSearchParams } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDuration } from "@/domain/format";
import { PUBLIC_DAYS } from "@/domain/public-stats";
import { addDays, dayKey } from "@/domain/zoned";
import { useGoals } from "@/features/data-hooks";
import { useDisplayNames, useFriendStats, useSocial } from "@/features/social";
import { useNow } from "@/features/useNow";

const dateFmt = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function FriendDetailScreen() {
  const uid = useSearchParams().get("uid");
  const social = useSocial();
  const ready = social.status === "ready";
  const stats = useFriendStats(ready ? uid : null);
  const names = useDisplayNames(uid && ready ? [uid] : []);
  const goals = useGoals();
  const today = dayKey(useNow(60_000), goals.timezone);
  const name = stats?.displayName ?? (uid ? names.get(uid) : undefined) ?? "フレンド";

  const series = Array.from({ length: PUBLIC_DAYS }, (_, i) => {
    const day = addDays(today, i - (PUBLIC_DAYS - 1));
    return { day, seconds: stats?.days?.[day] ?? 0 };
  });
  const max = Math.max(1800, ...series.map((d) => d.seconds));
  const week = series.slice(-7).reduce((a, d) => a + d.seconds, 0);

  return (
    <main className="px-safe mx-auto max-w-xl pb-8">
      <PageHeader title={name} subtitle="フレンドの記録" back="/friends/" />
      {!ready || stats === undefined ? (
        <p className="text-sm text-mute">読み込み中…</p>
      ) : stats === null ? (
        <Card className="text-sm text-mute">この人は学習記録を公開していないか、まだフレンドではありません。</Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-mute">今日</p>
              <p className="tabular text-xl font-bold" data-testid="friend-today">
                {formatDuration(stats.days?.[today] ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-mute">7日間</p>
              <p className="tabular text-xl font-bold">{formatDuration(week)}</p>
            </div>
            <div>
              <p className="text-xs text-mute">連続</p>
              <p className="tabular text-xl font-bold text-gold">{stats.streakDays}日</p>
            </div>
          </Card>

          <Card>
            <SectionTitle>直近{PUBLIC_DAYS}日</SectionTitle>
            <div className="flex h-32 items-end gap-1" role="img" aria-label={`直近${PUBLIC_DAYS}日の学習時間`}>
              {series.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col justify-end">
                  <div className={`rounded-t ${d.day === today ? "bg-gold" : "bg-sky/70"}`} style={{ height: `${Math.max(d.seconds > 0 ? 4 : 0, (d.seconds / max) * 100)}%` }} title={`${d.day} ${formatDuration(d.seconds)}`} />
                </div>
              ))}
            </div>
            <div className="tabular mt-1 flex justify-between text-[10px] text-mute">
              <span>{series[0].day.slice(5).replace("-", "/")}</span>
              <span>今日</span>
            </div>
          </Card>

          <Card className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-mute">累計</p>
              <p className="tabular font-bold">{formatDuration(stats.totals.focusSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-mute">フライト</p>
              <p className="tabular font-bold">{stats.totals.flights}便</p>
            </div>
            <div>
              <p className="text-xs text-mute">訪れた空港</p>
              <p className="tabular font-bold">{stats.totals.airports}</p>
            </div>
          </Card>

          <section>
            <SectionTitle>最近のフライト</SectionTitle>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-mute">まだフライトがありません。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.recent.map((r, i) => (
                  <li key={`${r.at}-${i}`} className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface/70 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="tabular block font-semibold">
                        {r.from} → {r.to}
                      </span>
                      <span className="tabular block text-xs text-mute">
                        {dateFmt.format(new Date(r.at))}
                        {r.subject && (
                          <>
                            {" · "}
                            <span style={{ color: r.color }}>●</span> {r.subject}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-bold">{r.minutes}分</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
