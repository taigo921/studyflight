import Link from "next/link";
import { SubjectBadge } from "@/components/ui/SubjectBadge";
import { formatDateTime, formatDuration } from "@/domain/format";
import type { FlightSession } from "@/domain/types";

export function statusLabel(s: Pick<FlightSession, "status" | "completionType">): { text: string; tone: string } {
  if (s.status === "completed") return s.completionType === "early" ? { text: "早期着陸", tone: "text-gold" } : { text: "定刻着陸", tone: "text-ok" };
  if (s.status === "abandoned") return { text: "欠航（記録外）", tone: "text-danger" };
  if (s.status === "paused") return { text: "一時停止中", tone: "text-gold" };
  if (s.status === "active") return { text: "飛行中", tone: "text-sky" };
  return { text: "搭乗待ち", tone: "text-mute" };
}

/** ログ一覧用の半券。 */
export function FlightStub({ session: s, timezone, href, onClick }: { session: FlightSession; timezone: string; href?: string; onClick?: () => void }) {
  const st = statusLabel(s);
  const body = (
    <div className={`flex items-stretch overflow-hidden rounded-2xl border border-line/70 bg-surface/90 text-left transition-colors hover:bg-elevated ${s.status === "abandoned" ? "opacity-70" : ""}`}>
      <div className="w-1.5 shrink-0" style={{ background: s.subjectColor }} aria-hidden />
      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <SubjectBadge name={s.subjectName} color={s.subjectColor} size="sm" />
          <span className={`text-xs font-semibold ${st.tone}`}>{st.text}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="tabular text-lg font-bold tracking-wide">{s.originCode}</span>
          <span className="relative h-px flex-1 border-t border-dashed border-line" aria-hidden>
            <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 text-[11px] text-mute">✈︎</span>
          </span>
          <span className="tabular text-lg font-bold tracking-wide">{s.destinationCode}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-mute">
          <span className="truncate">
            {formatDateTime(s.startedAt ?? s.createdAt, timezone)}
            {s.taskTitle ? ` · ${s.taskTitle}` : ""}
          </span>
          <span className="tabular shrink-0">
            <span className="font-semibold text-ink">{formatDuration(s.actualFocusSeconds ?? 0)}</span>
            {s.status === "completed" && <span className="ml-2 text-gold">+{s.earnedSkyPoints} SP</span>}
          </span>
        </div>
      </div>
    </div>
  );
  if (href)
    return (
      <Link href={href} className="block rounded-2xl" aria-label={`${s.originCode}から${s.destinationCode}、${s.subjectName}、${st.text}`}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block w-full rounded-2xl" aria-label={`${s.originCode}から${s.destinationCode}、${s.subjectName}、${st.text}`}>
        {body}
      </button>
    );
  return body;
}
