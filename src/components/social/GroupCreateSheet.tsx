"use client";

// 同乗フライトを作る（機長）。フレンドを選んで招待し、招待リンクでも誘える。
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { createGroup } from "@/data/social";
import type { Airport } from "@/domain/types";
import { useDisplayNames, useFriendships, useSocial } from "@/features/social";
import { toast } from "@/store/ui";

export function GroupCreateSheet({
  open,
  onClose,
  origin,
  destination,
  plannedMinutes,
  seat,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  origin: Airport;
  destination: Airport;
  plannedMinutes: number;
  seat: string;
  /** 同乗便を作ったあと、この端末の搭乗券を発行する */
  onCreated: (groupId: string) => Promise<void>;
}) {
  const social = useSocial();
  const uid = social.status === "ready" ? social.uid : null;
  const friendships = useFriendships(open ? uid : null);
  const friends = (friendships ?? []).filter((f) => f.status === "accepted").map((f) => f.members.find((m) => m !== uid)!);
  const names = useDisplayNames(friends);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!social.profile) return;
    setBusy(true);
    try {
      const gid = await createGroup({ host: social.profile, origin, destination, plannedMinutes, seat, invited: [...picked] });
      await onCreated(gid);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "同乗便を作れませんでした", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="友達と一緒に乗る"
      footer={
        social.status === "ready" ? (
          <Button size="lg" className="w-full" disabled={busy} onClick={create}>
            {picked.size > 0 ? `${picked.size}人を招待して同乗便を作る` : "同乗便を作る（あとでリンクで招待）"}
          </Button>
        ) : undefined
      }
    >
      {social.status !== "ready" ? (
        <div className="flex flex-col gap-3 text-sm text-mute">
          <p>同乗するには、先にフレンド機能をはじめてください。</p>
          <Link href="/friends/" className="font-semibold text-sky">
            フレンド機能をはじめる →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">
            あなたが機長です。全員がそろったら機長が出発し、同じ時刻に全員が出発します（{plannedMinutes}分）。
          </p>
          {friendships === undefined ? (
            <p className="text-sm text-mute">フレンドを読み込み中…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-mute">まだフレンドがいません。同乗便を作ったあと、招待リンクで誘えます。</p>
          ) : (
            <ul className="flex flex-col gap-1" aria-label="招待するフレンド">
              {friends.map((f) => (
                <li key={f}>
                  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line px-3">
                    <input
                      type="checkbox"
                      checked={picked.has(f)}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.add(f);
                          else next.delete(f);
                          return next;
                        })
                      }
                      className="size-5 accent-sky"
                    />
                    <span className="font-semibold">{names.get(f) ?? "…"}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
