"use client";

// フライト中の同乗者（友達）の様子: 集中中・一時停止・着陸・降りた、と集中時間。
import type { MemberStatus } from "@/data/social";
import { useGroupMembers, useSocial } from "@/features/social";

const STATUS: Record<MemberStatus, { label: string; dot: string }> = {
  boarding: { label: "搭乗中", dot: "bg-mute" },
  active: { label: "集中中", dot: "bg-ok" },
  paused: { label: "一時停止", dot: "bg-gold" },
  landed: { label: "着陸", dot: "bg-sky" },
  left: { label: "降りた", dot: "bg-white/30" },
};

export function CrewStrip({ groupId }: { groupId: string }) {
  const social = useSocial();
  const members = useGroupMembers(social.status === "ready" ? groupId : null);
  const others = (members ?? []).filter((m) => m.uid !== social.uid);
  if (others.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="同乗している友達" data-testid="crew-strip">
      {others.map((m) => {
        const st = STATUS[m.status] ?? STATUS.boarding;
        return (
          <li key={m.uid} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-night/65 py-1 pr-2.5 pl-1 text-[11px] shadow backdrop-blur-md">
            <span className="relative inline-flex size-6 items-center justify-center rounded-full bg-sky/20 text-[11px] font-bold text-sky" aria-hidden>
              {[...m.displayName][0]}
              <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-night ${st.dot}`} />
            </span>
            <span className="max-w-[6rem] truncate font-semibold">{m.displayName}</span>
            <span className="tabular text-mute">
              {st.label} · {Math.floor(m.focusSeconds / 60)}分
            </span>
          </li>
        );
      })}
    </ul>
  );
}
