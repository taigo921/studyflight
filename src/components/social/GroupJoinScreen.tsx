"use client";

// 同乗フライトに参加する（招待リンク /group/?id=...）。座席と科目を選ぶと、この端末に同じ便の搭乗券を発行する。
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SeatMap, seatKind } from "@/components/boarding/SeatMap";
import { SubjectPicker } from "@/components/flight/SubjectPicker";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { issueBoardingPass, OpenFlightExistsError } from "@/data/sessions";
import { joinGroup } from "@/data/social";
import { ensureUsableSubject } from "@/data/subjects";
import { airportDisplayName } from "@/domain/airport-search";
import { useBoardingFlight, useOpenFlight, useSubjects } from "@/features/data-hooks";
import { useGroup, useGroupMembers, useSocial } from "@/features/social";
import { useAirports } from "@/features/useAirports";
import { toast } from "@/store/ui";
import { SocialSetup } from "./SocialSetup";
import { InAppBrowserNotice } from "./InAppBrowserNotice";

export function GroupJoinScreen() {
  const gid = useSearchParams().get("id");
  const router = useRouter();
  const social = useSocial();
  const ready = social.status === "ready";
  const group = useGroup(ready ? gid : null);
  const members = useGroupMembers(ready ? gid : null);
  const boarding = useBoardingFlight();
  const open = useOpenFlight();
  const subjects = useSubjects();
  const { byId } = useAirports();
  const [seat, setSeat] = useState<string | null>(null);
  const [subjectChoice, setSubjectChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (subjects && subjects.length === 0) void ensureUsableSubject();
  }, [subjects]);

  // この便の搭乗券・フライトがすでにこの端末にあれば、そちらへ
  const mine = [boarding, open].find((s) => s && s.groupId === gid) ?? null;
  useEffect(() => {
    if (!mine) return;
    router.replace(mine.status === "boarding" ? "/boarding/" : `/flight/?id=${mine.id}`);
  }, [mine, router]);

  const friendSeats = useMemo(() => new Map((members ?? []).filter((m) => m.uid !== social.uid && m.status !== "left").map((m) => [m.seat, m.displayName])), [members, social.uid]);
  const subjectId = subjectChoice ?? subjects?.[0]?.id ?? null;
  const subject = subjects?.find((s) => s.id === subjectId) ?? null;

  const join = async () => {
    if (!group || !social.profile || !seat || !subject) return;
    const origin = byId.get(group.originId);
    const destination = byId.get(group.destinationId);
    if (!origin || !destination) return toast("空港データを読み込み中です。少し待ってからもう一度お試しください", "error");
    setBusy(true);
    try {
      await joinGroup(group.id, social.profile, seat);
      await issueBoardingPass({ subject, task: null, seat, origin, destination, plannedMinutes: group.plannedMinutes, groupId: group.id });
      router.push("/boarding/");
    } catch (e) {
      if (e instanceof OpenFlightExistsError) router.push(`/flight/?id=${e.sessionId}`);
      toast(e instanceof Error ? e.message : "乗れませんでした", "error");
      setBusy(false);
    }
  };

  if (social.status === "disabled") {
    return (
      <main className="px-safe mx-auto max-w-xl">
        <PageHeader title="同乗フライト" back="/" />
        <Card className="text-sm text-mute">フレンド機能は準備中です。</Card>
      </main>
    );
  }

  return (
    <main className="px-safe mx-auto max-w-xl pb-10">
      <PageHeader title="同乗フライト" subtitle="友達と同じ便で勉強する" back="/" />
      <InAppBrowserNotice />
      {(social.status === "signedOut" || social.status === "needsProfile") && <SocialSetup title="同乗するには表示名を決めてください" />}
      {social.status === "loading" || (ready && group === undefined) ? <p className="text-sm text-mute">読み込み中…</p> : null}
      {ready && group === null && <Card className="text-sm text-mute">この便は見つかりません。リンクが正しいか確認してください。</Card>}
      {ready && group && (
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-1">
            <p className="text-xs text-mute">{group.hostName} さんの便（機長）</p>
            <p className="tabular text-2xl font-bold">
              {group.originCode} <span className="text-gold">→</span> {group.destinationCode}
            </p>
            <p className="text-sm text-mute">
              {byId.get(group.originId) ? airportDisplayName(byId.get(group.originId)!) : group.originCode} から {byId.get(group.destinationId) ? airportDisplayName(byId.get(group.destinationId)!) : group.destinationCode} まで · {group.plannedMinutes}分
            </p>
            <p className="mt-1 text-xs text-mute">搭乗中: {(members ?? []).filter((m) => m.status !== "left").map((m) => `${m.displayName}（${m.seat}）`).join("、") || "—"}</p>
          </Card>

          {group.status === "cancelled" ? (
            <Card className="text-sm text-mute">この便は機長が取り消しました。</Card>
          ) : group.status !== "boarding" ? (
            <Card className="flex flex-col gap-3 text-sm text-mute">
              この便はすでに出発しました。
              <LinkButton href="/boarding/">自分の便を予約する</LinkButton>
            </Card>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <p className="font-semibold">座席を選ぶ{seat ? `: ${seat}（${seatKind(seat)}）` : ""}</p>
                <p className="text-xs text-mute">緑の席は友達の席です。隣に座るのもおすすめ。</p>
                <SeatMap seed={group.id} value={seat} onPick={setSeat} friends={friendSeats} />
              </section>
              <section className="flex flex-col gap-2">
                <p className="font-semibold">何を勉強しますか？</p>
                {subjects ? <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectChoice} /> : null}
              </section>
              <div className="pb-safe sticky bottom-0 -mx-4 border-t border-line bg-night/90 px-4 py-3 backdrop-blur-md">
                <Button size="lg" className="w-full" disabled={busy || !seat || !subject} onClick={join}>
                  {seat ? `${seat} でこの便に乗る` : "座席を選んでください"}
                </Button>
              </div>
            </>
          )}
          <Link href="/friends/" className="min-h-11 text-center text-sm text-mute">
            フレンド一覧へ
          </Link>
        </div>
      )}
    </main>
  );
}
