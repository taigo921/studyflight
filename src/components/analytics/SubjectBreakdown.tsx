import { formatDuration, percent } from "@/domain/format";

export interface SubjectSlice {
  id: string;
  name: string;
  color: string;
  seconds: number;
}

const MAX_SLICES = 7;

/** 科目別の配分。数値と割合を常にテキストで併記する（色だけに頼らない）。 */
export function SubjectBreakdown({ slices }: { slices: SubjectSlice[] }) {
  const sorted = [...slices].filter((s) => s.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  const shown = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((a, s) => a + s.seconds, 0);
  if (rest > 0) shown.push({ id: "other", name: "その他の科目", color: "#6b7a93", seconds: rest });
  const total = sorted.reduce((a, s) => a + s.seconds, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-mute">この期間の記録はまだありません</p>;
  return (
    <div className="flex flex-col gap-4">
      {/* 構成比の帯（2px の隙間で区切る） */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="科目別の構成比">
        {shown.map((s) => (
          <div key={s.id} style={{ width: `${(s.seconds / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {shown.map((s) => (
          <li key={s.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="tabular shrink-0 text-mute">
                <span className="font-semibold text-ink">{formatDuration(s.seconds)}</span> · {percent(s.seconds / total)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-elevated">
              <div className="h-full rounded-full" style={{ width: `${(s.seconds / sorted[0].seconds) * 100}%`, background: s.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
