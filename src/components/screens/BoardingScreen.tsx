"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AirportCombobox } from "@/components/flight/AirportCombobox";
import { BoardingPass, flightNumber } from "@/components/flight/BoardingPass";
import { DestinationPicker } from "@/components/flight/DestinationPicker";
import { DurationPicker } from "@/components/flight/DurationPicker";
import { SubjectPicker, TaskPicker } from "@/components/flight/SubjectPicker";
import { IconPlane, IconSeat } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SUGGESTED_AIRPORT_IDS } from "@/data/core-airports";
import { abandonFlight, departFlight, issueBoardingPass, OpenFlightExistsError, randomSeat } from "@/data/sessions";
import { ensureUsableSubject } from "@/data/subjects";
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { flightMinutesFor, reachableKm, currentLocationId, destinationCandidates, arrivalAirportId } from "@/domain/route-planner";
import { visitedAirports } from "@/domain/stats";
import { haversineKm } from "@/domain/geo";
import type { Airport } from "@/domain/types";
import { useBoardingFlight, useOpenFlight, usePreferences, useSessions, useSubjects, useTasks } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { toast } from "@/store/ui";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="flex flex-col gap-3">
      <h2 id={`step-${n}`} className="flex items-center gap-2 text-[15px] font-bold">
        <span className="tabular inline-flex size-6 items-center justify-center rounded-full bg-elevated text-xs text-sky">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BoardingScreen() {
  const router = useRouter();
  const open = useOpenFlight();
  const boarding = useBoardingFlight();
  const prefs = usePreferences();
  const subjects = useSubjects();
  const sessions = useSessions();
  const { airports, byId } = useAirports();

  // ユーザーの選択（null の間は下で導出する既定値を使う）
  const [subjectChoice, setSubjectId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [originChoice, setOrigin] = useState<Airport | null>(null);
  // 行き先: 候補から選んだもの、または「リストにない空港」から手動で選んだもの
  const [destChoice, setDestChoice] = useState<{ airport: Airport; manual: boolean } | null>(null);
  const [minutes, setMinutes] = useState<number | null>(25);
  const [seat, setSeat] = useState(randomSeat);
  const [busy, setBusy] = useState(false);

  // 科目が1つも無ければ「自由学習」を用意
  useEffect(() => {
    if (subjects && subjects.length === 0) void ensureUsableSubject();
  }, [subjects]);

  // 既定値: 前回の科目、出発地は前回の到着地（旅が続く）→ ホーム空港
  const lastCompleted = useMemo(() => sessions?.find((s) => s.status === "completed"), [sessions]);
  const subjectId = useMemo(() => {
    if (subjectChoice && subjects?.some((s) => s.id === subjectChoice)) return subjectChoice;
    if (!subjects || subjects.length === 0) return null;
    return (subjects.find((s) => s.id === lastCompleted?.subjectId) ?? subjects[0]).id;
  }, [subjectChoice, subjects, lastCompleted]);
  // 出発地 = 現在地（前回着陸した空港）。初回はホーム空港
  const currentId = useMemo(() => (sessions ? currentLocationId(sessions, prefs.homeAirportId) : null), [sessions, prefs.homeAirportId]);
  const origin = originChoice ?? (currentId ? (byId.get(currentId) ?? null) : null);
  const visited = useMemo(() => new Set(sessions ? visitedAirports(sessions).keys() : []), [sessions]);
  // 学習時間を変えて候補から外れたら選択を解除する（手動で選んだ空港は維持）
  const destination = useMemo(() => {
    if (!destChoice || !origin || minutes === null || destChoice.airport.id === origin.id) return null;
    if (destChoice.manual) return destChoice.airport;
    return destinationCandidates(origin, minutes, airports).some((c) => c.airport.id === destChoice.airport.id) ? destChoice.airport : null;
  }, [destChoice, origin, minutes, airports]);
  const tasks = useTasks(subjectId);

  const recent = useMemo(() => {
    const ids: string[] = [];
    for (const s of sessions ?? []) for (const id of [arrivalAirportId(s), s.originAirportId]) if (!ids.includes(id)) ids.push(id);
    if (prefs.homeAirportId && !ids.includes(prefs.homeAirportId)) ids.unshift(prefs.homeAirportId);
    return ids.map((id) => byId.get(id)).filter((a): a is Airport => !!a).slice(0, 6);
  }, [sessions, byId, prefs.homeAirportId]);
  const suggested = useMemo(() => SUGGESTED_AIRPORT_IDS.map((id) => byId.get(id)).filter((a): a is Airport => !!a), [byId]);

  const subject = subjects?.find((s) => s.id === subjectId) ?? null;
  const task = tasks?.find((t) => t.id === taskId) ?? null;
  const sameAirport = !!origin && !!destination && origin.id === destination.id;
  const canIssue = !!subject && !!origin && !!destination && !sameAirport && minutes !== null && !busy;
  const distanceKm = origin && destination ? haversineKm([origin.lng, origin.lat], [destination.lng, destination.lat]) : undefined;

  if (open) {
    return (
      <main className="px-safe mx-auto max-w-xl">
        <PageHeader title="搭乗手続き" />
        <Card className="flex flex-col gap-4">
          <p className="font-semibold">
            {open.originCode} → {open.destinationCode} のフライトが進行中です。
          </p>
          <p className="text-sm text-mute">同時に進められるフライトは1便だけです。現在のフライトを着陸させるか、破棄してから新しく予約してください。</p>
          <LinkButton href={`/flight/?id=${open.id}`}>フライトに戻る</LinkButton>
        </Card>
      </main>
    );
  }

  if (boarding) {
    const o = byId.get(boarding.originAirportId);
    const d = byId.get(boarding.destinationAirportId);
    return (
      <main className="px-safe mx-auto max-w-xl">
        <PageHeader title="搭乗券" subtitle="ご搭乗の準備ができました" back="/" />
        <div className="animate-fade-up flex flex-col gap-5">
          <BoardingPass
            data={{
              passenger: prefs.displayName || "Passenger",
              flightNo: flightNumber(boarding.id),
              subjectName: boarding.subjectName,
              subjectColor: boarding.subjectColor,
              taskTitle: boarding.taskTitle,
              origin: o ? { ...o, code: boarding.originCode } : { name: boarding.originCode, code: boarding.originCode },
              destination: d ? { ...d, code: boarding.destinationCode } : { name: boarding.destinationCode, code: boarding.destinationCode },
              minutes: boarding.plannedSeconds / 60,
              seat: boarding.seat,
              distanceKm: boarding.distanceKm,
              status: "搭乗手続き完了",
            }}
          />
          <p className="text-center text-xs text-mute">出発するとタイマーが始まります。画面を閉じても時刻にもとづいて進みます。</p>
          <Button
            size="lg"
            variant="gold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const s = await departFlight(boarding.id);
                router.push(`/flight/?id=${s.id}`);
              } catch (e) {
                toast(e instanceof Error ? e.message : "出発できませんでした", "error");
                setBusy(false);
              }
            }}
          >
            <IconPlane /> 出発する
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => abandonFlight(boarding.id, "boarding_cancelled")}>
            搭乗券を取り消す
          </Button>
        </div>
      </main>
    );
  }

  const issue = async () => {
    if (!subject || !origin || !destination || minutes === null) return;
    setBusy(true);
    try {
      await issueBoardingPass({ subject, task: task ? { id: task.id, title: task.title } : null, origin, destination, plannedMinutes: minutes, seat });
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof OpenFlightExistsError) router.push(`/flight/?id=${e.sessionId}`);
      toast(e instanceof Error ? e.message : "搭乗券を発行できませんでした", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="フライトを予約" subtitle="搭乗手続き" back="/" />
      <div className="flex flex-col gap-7">
        <Step n={1} title="何を勉強しますか？">
          {subjects ? <SubjectPicker subjects={subjects} value={subjectId} onChange={(id) => (setSubjectId(id), setTaskId(null))} /> : <div className="h-11 animate-pulse rounded-full bg-elevated" />}
          {subjectId && tasks && (
            <div className="rounded-2xl border border-line/60 bg-surface/60 p-3">
              <p className="mb-2 text-xs font-semibold text-mute">タスク（任意）</p>
              <TaskPicker subjectId={subjectId} tasks={tasks} value={taskId} onChange={setTaskId} />
            </div>
          )}
        </Step>

        <Step n={2} title="何分集中しますか？">
          <DurationPicker value={minutes} onChange={setMinutes} />
          {minutes !== null && <p className="px-1 text-xs text-mute">ジェット機の巡航速度（約800km/h）で、約{Math.round(reachableKm(minutes)).toLocaleString("ja-JP")}km 先まで飛べます。</p>}
        </Step>

        <Step n={3} title="どこへ飛びますか？">
          <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-surface/70 px-4 py-3">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-mute uppercase">現在地</span>
            {origin ? (
              <span className="min-w-0 flex-1">
                <span className="tabular mr-2 text-lg font-bold">{airportCodeOf(origin)}</span>
                <span className="text-sm">{airportDisplayName(origin)}</span>
              </span>
            ) : (
              <span className="flex-1 text-sm text-mute">出発する空港を選んでください</span>
            )}
          </div>
          {!origin ? (
            <AirportCombobox label="出発" value={null} onChange={setOrigin} airports={airports} recent={recent} suggested={suggested} />
          ) : minutes === null ? (
            <p className="text-sm text-mute">集中する時間を決めると、行き先の候補が表示されます。</p>
          ) : (
            <>
              <DestinationPicker origin={origin} minutes={minutes} airports={airports} visited={visited} value={destination} onChange={(a) => setDestChoice({ airport: a, manual: false })} />
              <details className="rounded-2xl border border-line/60 bg-surface/40 px-4 py-2 text-sm">
                <summary className="min-h-11 cursor-pointer content-center text-mute">リストにない空港へ飛ぶ・出発地を変える</summary>
                <div className="flex flex-col gap-3 pt-2 pb-2">
                  <AirportCombobox label="到着" value={destChoice?.manual ? destChoice.airport : null} onChange={(a) => setDestChoice({ airport: a, manual: true })} airports={airports} recent={recent} suggested={suggested} exclude={origin.id} />
                  {destination && destChoice?.manual && distanceKm !== undefined && Math.abs(flightMinutesFor(distanceKm) - (minutes ?? 0)) > (minutes ?? 0) * 0.5 && (
                    <p className="text-xs text-gold">この距離は飛行時間の目安（約{Math.round(flightMinutesFor(distanceKm))}分）と学習時間が大きく異なります。飛行機は学習時間に合わせて進みます。</p>
                  )}
                  <AirportCombobox label="出発" value={originChoice} onChange={(a) => (setOrigin(a), setDestChoice(null))} airports={airports} recent={recent} suggested={suggested} />
                  <p className="text-xs text-mute">ふだんは前回着陸した空港から出発します。ここで変えると旅の軌跡はいったん区切られます。</p>
                </div>
              </details>
            </>
          )}
          {sameAirport && (
            <p className="text-sm text-danger" role="alert">
              出発地と到着地は別の空港を選んでください
            </p>
          )}
          <button type="button" onClick={() => setSeat(randomSeat())} className="flex min-h-11 items-center gap-2 self-start rounded-full px-1 text-sm text-mute hover:text-ink">
            <IconSeat size={20} /> 座席 <span className="tabular font-semibold text-ink">{seat}</span>
            <span className="text-xs text-sky">変更</span>
          </button>
        </Step>

        <section aria-label="搭乗券プレビュー" className="flex flex-col gap-4">
          <BoardingPass
            data={{
              passenger: prefs.displayName || "Passenger",
              flightNo: "SF ----",
              subjectName: subject?.name ?? "科目を選択",
              subjectColor: subject?.color ?? "#A4B3CC",
              taskTitle: task?.title,
              origin: origin ? { ...origin, code: airportCodeOf(origin) } : undefined,
              destination: destination ? { ...destination, code: airportCodeOf(destination) } : undefined,
              minutes: minutes ?? 0,
              seat,
              distanceKm,
            }}
          />
          <Button size="lg" disabled={!canIssue} onClick={issue} className="w-full">
            搭乗券を発行
          </Button>
          {!origin || !destination ? <p className="text-center text-xs text-mute">行き先を選ぶと発行できます</p> : null}
        </section>
      </div>
    </main>
  );
}
