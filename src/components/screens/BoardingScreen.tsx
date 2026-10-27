"use client";

// 搭乗手続き: 座席 → 科目 → 地図で時間と行き先 → 搭乗券のチェックイン → 出発。
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DurationRuler } from "@/components/boarding/DurationRuler";
import { SeatMap, seatKind } from "@/components/boarding/SeatMap";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AirportCombobox } from "@/components/flight/AirportCombobox";
import { BoardingPass, flightNumber } from "@/components/flight/BoardingPass";
import { DestinationPicker } from "@/components/flight/DestinationPicker";
import { SubjectPicker, TaskPicker } from "@/components/flight/SubjectPicker";
import { IconChevronLeft, IconLog, IconPlane } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { SUGGESTED_AIRPORT_IDS } from "@/data/core-airports";
import { abandonFlight, departFlight, issueBoardingPass, OpenFlightExistsError } from "@/data/sessions";
import { ensureUsableSubject } from "@/data/subjects";
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { formatKm } from "@/domain/format";
import { arrivalAirportId, currentLocationId, destinationCandidates, reachableKm } from "@/domain/route-planner";
import { visitedAirports } from "@/domain/stats";
import type { Airport, FlightSession } from "@/domain/types";
import { dayKey } from "@/domain/zoned";
import { useBoardingFlight, useOpenFlight, usePreferences, useSessions, useSubjects, useTasks } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { isWebGLAvailable } from "@/lib/world";
import { toast } from "@/store/ui";

const RoutePickerMap = dynamic(() => import("@/components/boarding/RoutePickerMap"), { ssr: false, loading: () => null });
const noop = () => () => {};
const glassBtn = "inline-flex size-12 items-center justify-center rounded-full border border-white/15 bg-night/60 text-ink shadow-lg backdrop-blur-md";

function BackButton({ onClick, href, label = "戻る" }: { onClick?: () => void; href?: string; label?: string }) {
  return href ? (
    <Link href={href} aria-label={label} className={glassBtn}>
      <IconChevronLeft />
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={glassBtn}>
      <IconChevronLeft />
    </button>
  );
}

export function BoardingScreen() {
  const open = useOpenFlight();
  const boarding = useBoardingFlight();

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
  if (open === undefined || boarding === undefined) return <main className="min-h-dvh" aria-busy="true" />;
  if (boarding) return <PassStep key={boarding.id} boarding={boarding} />;
  return <BookingSteps />;
}

// ---------------------------------------------------------------------------
// 予約（座席 → 科目 → 行き先）

function BookingSteps() {
  const router = useRouter();
  const prefs = usePreferences();
  const subjects = useSubjects();
  const sessions = useSessions();
  const { airports, byId } = useAirports();
  const webgl = useSyncExternalStore(noop, isWebGLAvailable, () => false);
  const [mapFailed, setMapFailed] = useState(false);

  const [step, setStep] = useState<"seat" | "route">("seat");
  const [seat, setSeat] = useState<string | null>(null);
  const [seatSeed] = useState(() => dayKey(Date.now(), "UTC"));
  const [subjectSheet, setSubjectSheet] = useState(false);
  const [subjectChoice, setSubjectId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [originChoice, setOrigin] = useState<Airport | null>(null);
  const [destChoice, setDestChoice] = useState<{ airport: Airport; manual: boolean } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const [panelH, setPanelH] = useState(320);

  useEffect(() => {
    if (subjects && subjects.length === 0) void ensureUsableSubject();
  }, [subjects]);

  const lastCompleted = useMemo(() => sessions?.find((s) => s.status === "completed"), [sessions]);
  const subjectId = useMemo(() => {
    if (subjectChoice && subjects?.some((s) => s.id === subjectChoice)) return subjectChoice;
    if (!subjects || subjects.length === 0) return null;
    return (subjects.find((s) => s.id === lastCompleted?.subjectId) ?? subjects[0]).id;
  }, [subjectChoice, subjects, lastCompleted]);
  const tasks = useTasks(subjectId);
  const subject = subjects?.find((s) => s.id === subjectId) ?? null;
  const task = tasks?.find((t) => t.id === taskId) ?? null;

  const currentId = useMemo(() => (sessions ? currentLocationId(sessions, prefs.homeAirportId) : null), [sessions, prefs.homeAirportId]);
  const origin = originChoice ?? (currentId ? (byId.get(currentId) ?? null) : null);
  const visited = useMemo(() => new Set(sessions ? visitedAirports(sessions).keys() : []), [sessions]);
  const candidates = useMemo(() => (origin ? destinationCandidates(origin, minutes, airports, { limit: 40 }) : []), [origin, minutes, airports]);
  const destination = useMemo(() => {
    if (!destChoice || !origin || destChoice.airport.id === origin.id) return null;
    if (destChoice.manual) return destChoice.airport;
    return candidates.some((c) => c.airport.id === destChoice.airport.id) ? destChoice.airport : null;
  }, [destChoice, origin, candidates]);
  const recent = useMemo(() => {
    const ids: string[] = [];
    for (const s of sessions ?? []) for (const id of [arrivalAirportId(s), s.originAirportId]) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => byId.get(id)).filter((a): a is Airport => !!a).slice(0, 6);
  }, [sessions, byId]);
  const suggested = useMemo(() => SUGGESTED_AIRPORT_IDS.map((id) => byId.get(id)).filter((a): a is Airport => !!a), [byId]);

  // 下部パネルの高さに合わせて地図の表示範囲を調整
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, origin]);

  // 選択中のカードを横スクロールで見える位置へ
  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!destination) return;
    carouselRef.current?.querySelector<HTMLElement>(`[data-airport="${destination.id}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [destination]);

  const issue = async () => {
    if (!subject || !origin || !destination || !seat) return;
    setBusy(true);
    try {
      await issueBoardingPass({ subject, task: task ? { id: task.id, title: task.title } : null, origin, destination, plannedMinutes: minutes, seat });
    } catch (e) {
      if (e instanceof OpenFlightExistsError) router.push(`/flight/?id=${e.sessionId}`);
      toast(e instanceof Error ? e.message : "搭乗券を発行できませんでした", "error");
      setBusy(false);
    }
  };

  if (step === "seat") {
    return (
      <main className="px-safe mx-auto max-w-xl pb-8">
        <PageHeader title="座席を選ぶ" subtitle="搭乗手続き" back="/" />
        <p className="-mt-2 mb-4 text-sm text-mute">好きな席をタップしてください。座席は演出で、学習の記録には影響しません。</p>
        <SeatMap
          seed={seatSeed}
          value={seat}
          onPick={(s) => {
            setSeat(s);
            setSubjectSheet(true);
          }}
        />
        <Sheet
          open={subjectSheet}
          onClose={() => setSubjectSheet(false)}
          title={seat ? `座席 ${seat}（${seatKind(seat)}）` : "座席"}
          footer={
            <Button
              size="lg"
              className="w-full"
              disabled={!subject}
              onClick={() => {
                setSubjectSheet(false);
                setStep("route");
              }}
            >
              この席で行き先を選ぶ
            </Button>
          }
        >
          <p className="mb-3 font-semibold">何を勉強しますか？</p>
          {subjects ? <SubjectPicker subjects={subjects} value={subjectId} onChange={(id) => (setSubjectId(id), setTaskId(null))} /> : null}
          {subjectId && tasks && (
            <div className="mt-4 rounded-2xl border border-line/60 bg-night/40 p-3">
              <p className="mb-2 text-xs font-semibold text-mute">タスク（任意）</p>
              <TaskPicker subjectId={subjectId} tasks={tasks} value={taskId} onChange={setTaskId} />
            </div>
          )}
        </Sheet>
      </main>
    );
  }

  // 出発地が未設定（初回でホーム空港なし）
  if (!origin) {
    return (
      <main className="px-safe mx-auto max-w-xl">
        <PageHeader title="出発する空港" subtitle="旅のスタート地点" />
        <p className="mb-4 text-sm text-mute">最初のフライトの出発地を選んでください。着陸した空港が次の出発地になります。</p>
        <AirportCombobox label="出発" value={null} onChange={setOrigin} airports={airports} recent={recent} suggested={suggested} />
      </main>
    );
  }

  const showMap = webgl && !mapFailed;

  return (
    <main className="relative h-dvh overflow-hidden bg-night">
      {showMap ? (
        <ErrorBoundary fallback={null} onError={() => setMapFailed(true)}>
          <RoutePickerMap
            origin={origin}
            reachKm={reachableKm(minutes)}
            candidates={candidates}
            selectedId={destination?.id ?? null}
            onSelect={(a) => setDestChoice({ airport: a, manual: false })}
            styleId={prefs.mapStyle}
            labels={prefs.mapLabels}
            bottomInset={panelH}
          />
        </ErrorBoundary>
      ) : (
        <div className="absolute inset-0 overflow-y-auto px-4 pt-28" style={{ paddingBottom: panelH + 16 }}>
          <DestinationPicker origin={origin} minutes={minutes} airports={airports} visited={visited} value={destination} onChange={(a) => setDestChoice({ airport: a, manual: false })} />
        </div>
      )}

      {/* 上部 */}
      <header className="px-safe pt-safe pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className="pointer-events-auto flex items-center gap-3">
          <BackButton onClick={() => setStep("seat")} label="座席選択に戻る" />
          <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-night/60 px-3 py-2 shadow-lg backdrop-blur-md">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-mute">現在地</p>
            <p className="truncate text-sm">
              <span className="tabular mr-1.5 font-bold text-gold">{airportCodeOf(origin)}</span>
              {airportDisplayName(origin)}
            </p>
          </div>
          <button type="button" onClick={() => setListOpen(true)} aria-label="行き先をリストで選ぶ・出発地を変える" className={glassBtn}>
            <IconLog size={20} />
          </button>
        </div>
      </header>

      {/* 下部パネル */}
      <section ref={panelRef} className="px-safe pb-safe absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] border-t border-white/10 bg-night/85 pt-3 backdrop-blur-xl" aria-label="時間と行き先">
        <div className="mx-auto max-w-xl">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-semibold text-mute">集中する時間</p>
            <p className="tabular text-sm text-mute">
              <span className="text-2xl font-bold text-ink" data-testid="ruler-value">
                {minutes}
              </span>{" "}
              分 · 約{Math.round(reachableKm(minutes)).toLocaleString("ja-JP")}km 先まで
            </p>
          </div>
          <DurationRuler value={minutes} onChange={setMinutes} />
          <div ref={carouselRef} role="radiogroup" aria-label="行き先の候補" className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
            {candidates.map((c) => {
              const on = destination?.id === c.airport.id;
              return (
                <button
                  key={c.airport.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-airport={c.airport.id}
                  onClick={() => setDestChoice({ airport: c.airport, manual: false })}
                  className={`w-[132px] shrink-0 snap-center rounded-2xl border p-3 text-left transition-colors ${on ? "border-gold bg-gold/15" : "border-line bg-surface/80"}`}
                >
                  <span className="flex items-center justify-between">
                    <span className={`tabular text-lg font-bold tracking-wide ${on ? "text-gold" : "text-ink"}`}>{airportCodeOf(c.airport)}</span>
                    {!visited.has(c.airport.id) && <span className="rounded-full border border-gold/50 px-1.5 text-[9px] font-semibold text-gold">初</span>}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold">{c.airport.nameJa ?? c.airport.municipality ?? c.airport.name}</span>
                  <span className="tabular block text-[11px] text-mute">
                    約{Math.round(c.flightMinutes)}分 · {formatKm(c.distanceKm)}
                  </span>
                </button>
              );
            })}
          </div>
          <Button size="lg" className="w-full" disabled={!destination || busy || !seat || !subject} onClick={issue}>
            {destination ? `${airportCodeOf(destination)} 行きの搭乗券を発行` : "行き先を選んでください"}
          </Button>
        </div>
      </section>

      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="行き先を選ぶ" tall>
        <DestinationPicker
          origin={origin}
          minutes={minutes}
          airports={airports}
          visited={visited}
          value={destination}
          onChange={(a) => {
            setDestChoice({ airport: a, manual: false });
            setListOpen(false);
          }}
        />
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm font-semibold">リストにない空港へ飛ぶ</p>
          <AirportCombobox
            label="到着"
            value={destChoice?.manual ? destChoice.airport : null}
            onChange={(a) => {
              setDestChoice({ airport: a, manual: true });
              setListOpen(false);
            }}
            airports={airports}
            recent={recent}
            suggested={suggested}
            exclude={origin.id}
          />
          <p className="text-xs text-mute">候補外の空港を選んだ場合も、飛行機は学習時間に合わせて進みます。</p>
          <p className="pt-2 text-sm font-semibold">出発地を変える</p>
          <AirportCombobox label="出発" value={originChoice} onChange={(a) => (setOrigin(a), setDestChoice(null))} airports={airports} recent={recent} suggested={suggested} />
          <p className="text-xs text-mute">ふだんは前回着陸した空港から出発します。変えると旅の軌跡はいったん区切られます。</p>
        </div>
      </Sheet>
    </main>
  );
}

// ---------------------------------------------------------------------------
// 搭乗券 → チェックイン → 出発

function PassStep({ boarding }: { boarding: FlightSession }) {
  const router = useRouter();
  const prefs = usePreferences();
  const { byId } = useAirports();
  const webgl = useSyncExternalStore(noop, isWebGLAvailable, () => false);
  const [phase, setPhase] = useState<"pass" | "checked" | "gate">("pass");
  const [busy, setBusy] = useState(false);
  const o = byId.get(boarding.originAirportId);
  const d = byId.get(boarding.destinationAirportId);

  const depart = async () => {
    setBusy(true);
    try {
      const s = await departFlight(boarding.id);
      router.push(`/flight/?id=${s.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "出発できませんでした", "error");
      setBusy(false);
    }
  };

  if (phase === "gate") {
    return (
      <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0b1730] via-night to-black px-8 text-center">
        <div className="animate-fade-up flex flex-col items-center gap-6">
          <span className="inline-flex size-16 items-center justify-center rounded-full border border-gold/40 text-gold">
            <IconPlane size={30} />
          </span>
          <p className="text-2xl leading-relaxed font-bold">
            ドアクローズ。
            <br />
            まもなく離陸します。
          </p>
          <p className="text-sm text-mute">
            {boarding.originCode} → {boarding.destinationCode} · {boarding.plannedSeconds / 60}分 · {boarding.subjectName}
          </p>
        </div>
        <div className="pb-safe absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-8">
          <Button size="lg" variant="gold" className="w-full max-w-xs" disabled={busy} onClick={depart}>
            出発する
          </Button>
          <button type="button" onClick={() => setPhase("checked")} className="min-h-11 text-sm text-mute">
            戻る
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-night">
      {webgl && o && d && (
        <ErrorBoundary fallback={null}>
          <RoutePickerMap
            origin={o}
            reachKm={0}
            candidates={[{ airport: d, distanceKm: boarding.distanceKm, flightMinutes: 0, domestic: true }]}
            selectedId={d.id}
            onSelect={() => {}}
            styleId={prefs.mapStyle}
            labels={prefs.mapLabels}
            bottomInset={470}
          />
        </ErrorBoundary>
      )}
      <header className="px-safe pt-safe absolute inset-x-0 top-0 z-10 flex items-center justify-between">
        <BackButton href="/" label="ホームへ" />
        <button type="button" onClick={() => abandonFlight(boarding.id, "boarding_cancelled")} className="min-h-11 rounded-full border border-white/15 bg-night/60 px-4 text-sm text-mute backdrop-blur-md">
          取り消す
        </button>
      </header>
      <section className="px-safe pb-safe absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-md flex-col gap-4 pb-2">
          <div className={`transition-[margin] duration-700 ${phase === "checked" ? "mb-12" : ""}`}>
            <BoardingPass
              torn={phase !== "pass"}
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
              }}
            />
          </div>
          {phase === "pass" ? (
            <Button size="lg" className="w-full" onClick={() => setPhase("checked")}>
              チェックイン
            </Button>
          ) : (
            <>
              <p className="animate-fade-up rounded-2xl border border-line bg-surface/90 px-4 py-3 text-xs text-mute">
                通知が気になるときは、iPhone の「集中モード」をオンにすると集中しやすくなります。
              </p>
              <Button size="lg" variant="gold" className="w-full" onClick={() => setPhase("gate")}>
                <IconPlane size={20} /> 搭乗する
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
