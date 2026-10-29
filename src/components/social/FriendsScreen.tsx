"use client";

// フレンド: 自分のフレンドコード、コードで追加、申請の承認、同乗フライトの招待、フレンドの今日の学習時間。
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconChevronRight, IconShare, IconUsers } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { updatePreferences } from "@/data/settings";
import { acceptFriend, addFriendByCode, friendLink, normalizeFriendCode, removeFriend, updateDisplayName, type Friendship } from "@/data/social";
import { formatDuration } from "@/domain/format";
import { dayKey } from "@/domain/zoned";
import { useGoals, usePreferences } from "@/features/data-hooks";
import { useNow } from "@/features/useNow";
import { setSocialProfile, useDisplayNames, useFriendships, useFriendStats, useGroupInvites, useSocial } from "@/features/social";
import { shareLink } from "@/lib/share-link";
import { confirmDialog, toast } from "@/store/ui";
import { SocialSetup } from "./SocialSetup";

function FriendRow({ uid, name, onRemove }: { uid: string; name: string; onRemove: () => void }) {
  const stats = useFriendStats(uid);
  const goals = useGoals();
  const today = dayKey(useNow(60_000), goals.timezone);
  const todaySeconds = stats?.days?.[today] ?? 0;
  return (
    <li className="flex items-center gap-3 px-2">
      <Link href={`/friends/view/?uid=${encodeURIComponent(uid)}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sky/15 font-bold text-sky" aria-hidden>
          {[...name][0] ?? "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="tabular block text-xs text-mute">
            {stats === undefined ? "読み込み中…" : stats === null ? "記録は非公開" : `今日 ${formatDuration(todaySeconds)}${stats.streakDays ? ` · ${stats.streakDays}日連続` : ""}`}
          </span>
        </span>
        <IconChevronRight className="text-mute" />
      </Link>
      <button type="button" onClick={onRemove} className="min-h-11 shrink-0 rounded-xl px-2 text-xs text-mute hover:text-danger" aria-label={`${name}をフレンドから外す`}>
        外す
      </button>
    </li>
  );
}

export function FriendsScreen() {
  const social = useSocial();
  const prefs = usePreferences();
  const router = useRouter();
  const addParam = useSearchParams().get("add");
  const uid = social.status === "ready" ? social.uid : null;
  const friendships = useFriendships(uid);
  const invites = useGroupInvites(uid);
  const others = (friendships ?? []).map((f) => f.members.find((m) => m !== uid)!).filter(Boolean);
  const names = useDisplayNames([...others, ...(invites ?? []).map((g) => g.host)]);
  const [code, setCode] = useState(addParam ? normalizeFriendCode(addParam) : "");
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const autoAdded = useRef(false);

  const add = async (raw = code) => {
    if (!uid) return;
    setBusy(true);
    try {
      const r = await addFriendByCode(uid, raw);
      toast(r === "accepted" ? "フレンドになりました" : r === "already" ? "すでにフレンドです" : "フレンド申請を送りました", "success");
      setCode("");
      if (addParam) router.replace("/friends/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "追加できませんでした", "error");
    } finally {
      setBusy(false);
    }
  };

  // 招待リンク（?add=コード）から開いたら、準備ができしだい申請する
  useEffect(() => {
    if (!uid || !addParam || autoAdded.current || social.profile?.friendCode === normalizeFriendCode(addParam)) return;
    autoAdded.current = true;
    void add(addParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, addParam]);

  const unfriend = async (f: Friendship, name: string) => {
    const ok = await confirmDialog({ title: `${name}をフレンドから外しますか？`, message: "お互いの学習記録が見られなくなります。", confirmLabel: "外す", tone: "danger" });
    if (ok) await removeFriend(f.id).catch(() => toast("外せませんでした", "error"));
  };

  if (social.status === "disabled") {
    return (
      <main className="px-safe mx-auto max-w-xl">
        <PageHeader title="フレンド" back="/" />
        <Card className="text-sm text-mute">フレンド機能は準備中です。公開の準備ができると、ここから友達を追加できるようになります。</Card>
      </main>
    );
  }

  const accepted = (friendships ?? []).filter((f) => f.status === "accepted");
  const incoming = (friendships ?? []).filter((f) => f.status === "pending" && f.requester !== uid);
  const outgoing = (friendships ?? []).filter((f) => f.status === "pending" && f.requester === uid);
  const other = (f: Friendship) => f.members.find((m) => m !== uid)!;
  const nameOf = (u: string) => names.get(u) ?? "…";

  return (
    <main className="px-safe mx-auto max-w-xl pb-8">
      <PageHeader title="フレンド" back="/" />
      {social.status === "loading" && <p className="text-sm text-mute">読み込み中…</p>}
      {social.status === "error" && <Card className="text-sm text-danger">フレンド機能に接続できません。通信状況を確認してください。</Card>}
      {(social.status === "signedOut" || social.status === "needsProfile") && <SocialSetup />}

      {social.status === "ready" && social.profile && (
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-mute">あなた</p>
                {editingName === null ? (
                  <button type="button" className="truncate text-left text-lg font-bold" onClick={() => setEditingName(social.profile!.displayName)}>
                    {social.profile.displayName} <span className="text-xs font-normal text-sky">変更</span>
                  </button>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await updateDisplayName(social.profile!.uid, editingName);
                        setSocialProfile({ ...social.profile!, displayName: editingName.trim() });
                        setEditingName(null);
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "変更できませんでした", "error");
                      }
                    }}
                  >
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} maxLength={24} aria-label="表示名" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-night px-3" />
                    <Button type="submit">保存</Button>
                  </form>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-mute">フレンドコード</p>
                <p className="tabular font-mono text-lg font-bold tracking-widest text-gold" data-testid="my-friend-code">
                  {social.profile.friendCode}
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => shareLink(friendLink(social.profile!.friendCode), `StudyFlight でフレンドになろう！ フレンドコード: ${social.profile!.friendCode}`)}>
              <IconShare size={20} /> 招待リンクを送る
            </Button>
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>フレンドを追加</SectionTitle>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(normalizeFriendCode(e.target.value))}
                placeholder="フレンドコード（8文字）"
                aria-label="フレンドコード"
                autoCapitalize="characters"
                className="tabular min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-night px-3 font-mono tracking-widest uppercase"
              />
              <Button type="submit" disabled={busy || code.length !== 8}>
                申請
              </Button>
            </form>
          </Card>

          {invites && invites.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>同乗フライトの招待</SectionTitle>
              {invites.map((g) => (
                <Link key={g.id} href={`/group/?id=${g.id}`} className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3">
                  <IconUsers className="text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {g.originCode} → {g.destinationCode} · {g.plannedMinutes}分
                    </span>
                    <span className="block text-xs text-mute">{g.hostName ?? nameOf(g.host)} さんの便</span>
                  </span>
                  <IconChevronRight className="text-mute" />
                </Link>
              ))}
            </section>
          )}

          {incoming.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>フレンド申請</SectionTitle>
              {incoming.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-sky/40 bg-sky/10 p-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(other(f))}</span>
                  <button type="button" className="min-h-11 rounded-xl px-3 text-sm text-mute" onClick={() => removeFriend(f.id)}>
                    断る
                  </button>
                  <Button onClick={() => acceptFriend(f.id).then(() => toast("フレンドになりました", "success"))}>承認</Button>
                </div>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionTitle>フレンド（{accepted.length}）</SectionTitle>
            <Card className="p-2">
              {friendships === undefined ? (
                <p className="p-3 text-sm text-mute">読み込み中…</p>
              ) : accepted.length === 0 ? (
                <p className="flex items-center gap-2 p-3 text-sm text-mute">
                  <IconUsers size={20} /> まだフレンドがいません。招待リンクを送るか、相手のフレンドコードを入力してください。
                </p>
              ) : (
                <ul className="divide-y divide-line/50">
                  {accepted.map((f) => (
                    <FriendRow key={f.id} uid={other(f)} name={nameOf(other(f))} onRemove={() => unfriend(f, nameOf(other(f)))} />
                  ))}
                </ul>
              )}
            </Card>
            {outgoing.length > 0 && <p className="px-1 text-xs text-mute">承認待ち: {outgoing.map((f) => nameOf(other(f))).join("、")}</p>}
          </section>

          <Card className="flex flex-col gap-1">
            <SectionTitle>公開する内容</SectionTitle>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={prefs.socialShareStats} onChange={(e) => updatePreferences({ socialShareStats: e.target.checked })} className="size-5 accent-sky" />
              学習記録の要約をフレンドに公開する
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                disabled={!prefs.socialShareStats}
                checked={prefs.socialShowSubjects}
                onChange={(e) => updatePreferences({ socialShowSubjects: e.target.checked })}
                className="size-5 accent-sky"
              />
              科目名も公開する
            </label>
            <p className="text-xs text-mute">公開されるのは、日別の学習時間・連続日数・最近の便（区間と時間）です。メモ・タスク名は公開しません。</p>
          </Card>
        </div>
      )}
    </main>
  );
}
