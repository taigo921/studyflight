"use client";

// 行き先選び: 学習時間 → 実在路線（直行便実績）にもとづく候補 → 搭乗券の発行。
// 上空で止まっている区間があれば、その続きを飛ぶ画面を出す。
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DurationRuler } from "@/components/boarding/DurationRuler";
import { CandidateCard, SourceBadge } from "@/components/boarding/FlightCandidateViews";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AirportCombobox } from "@/components/flight/AirportCombobox";
import { DestinationPicker } from "@/components/flight/DestinationPicker";
import { IconChevronLeft, IconLog, IconTarget } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressRing";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SUGGESTED_AIRPORT_IDS } from "@/data/core-airports";
import { cancelLeg, issueBoardingPass, OpenFlightExistsError } from "@/data/sessions";
import { updatePreferences } from "@/data/settings";
import { setFinalDestination, abandonTrip } from "@/data/trips";
import { airportCodeOf, airportDisplayName } from "@/domain/airport-search";
import { kmForBlockMinutes } from "@/domain/flight-time";
import { formatKm } from "@/domain/format";
import { haversineKm } from "@/domain/geo";
import { arrivalAirportId, travelState } from "@/domain/route-planner";
import { buildCandidate, planItinerary, searchFlights, type FlightCandidate } from "@/domain/route-search";
import { visitedAirports } from "@/domain/stats";
import type { Airport, FlightLeg, StudyTask, Subject } from "@/domain/types";
import { useActiveTrip, useLegs, usePreferences, useSessions } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { useRouteGraph } from "@/features/useRouteGraph";
import { isWebGLAvailable } from "@/lib/world";
import { confirmDialog, toast } from "@/store/ui";

const RoutePickerMap = dynamic(() => import("@/components/boarding/RoutePickerMap"), { ssr: false, loading: () => null });
const noop = () => () => {};
export const glassBtn = "inline-flex size-12 items-center justify-center rounded-full border border-white/15 bg-night/60 text-ink shadow-lg backdrop-blur-md";

interface Props {
  seat: string;
  subject: Pick<Subject, "id" | "name" | "color">;
  task: StudyTask | null;
  onBack: () => void;
}

export function RouteStep(props: Props) {
  const sessions = useSessions();
  const legs = useLegs();
  const prefs = usePreferences();
  if (!sessions || !legs || !prefs.loaded) return <main className="min-h-dvh" aria-busy="true" />;
  const st = travelState(sessions, legs, prefs.homeAirportId);
  if (st.kind === "air") return <ResumeLeg {...props} leg={st.leg} />;
  return <ChooseRoute {...props} groundId={st.airportId} />;
}

// ---------------------------------------------------------------------------

function useIssue(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (input: Omit<Parameters<typeof issueBoardingPass>[0], "subject" | "task" | "seat">) => {
    setBusy(true);
    try {
      await issueBoardingPass({ ...input, subject: props.subject, task: props.task ? { id: props.task.id, title: props.task.title } : null, seat: props.seat });
    } catch (e) {
      if (e instanceof OpenFlightExistsError) router.push(`/flight/?id=${e.sessionId}`);
      toast(e instanceof Error ? e.message : "搭乗券を発行できませんでした", "error");
      setBusy(false);
    }
  };
  return { busy, run };
}

/** 上空で止まっている区間の続き */
function ResumeLeg(props: Props & { leg: FlightLeg }) {
  const { leg } = props;
  const prefs = usePreferences();
  const { byId } = useAirports();
  const webgl = useSyncExternalStore(noop, isWebGLAvailable, () => false);
  const [minutes, setMinutes] = useState(30);
  const { busy, run } = useIssue(props);
  const o = byId.get(leg.originAirportId);
  const d = byId.get(leg.destinationAirportId);
  const remainingMin = Math.ceil((leg.scheduledSeconds - leg.flownSeconds) / 60);
  const thisTime = Math.min(minutes, remainingMin);
  const progress = leg.flownSeconds / leg.scheduledSeconds;

  return (
    <main className="relative h-dvh overflow-hidden bg-night">
      {webgl && o && d && (
        <ErrorBoundary fallback={null}>
          <RoutePickerMap origin={o} reachKm={0} candidates={[{ airport: d }]} selectedId={d.id} onSelect={() => {}} styleId={prefs.mapStyle} labels={prefs.mapLabels} quality={prefs.renderQuality} bottomInset={420} />
        </ErrorBoundary>
      )}
      <header className="px-safe pt-safe absolute inset-x-0 top-0 z-10 flex items-center gap-3">
        <button type="button" onClick={props.onBack} aria-label="座席選択に戻る" className={glassBtn}>
          <IconChevronLeft />
        </button>
        <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-night/60 px-3 py-2 shadow-lg backdrop-blur-md">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-gold">上空で一時停止中</p>
          <p className="tabular truncate text-sm font-bold">
            {leg.originCode} → {leg.destinationCode} · {Math.round(progress * 100)}%
          </p>
        </div>
      </header>
      <section className="px-safe pb-safe absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] border-t border-white/10 bg-night/90 pt-4 backdrop-blur-xl" aria-label="続きのフライト">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-lg font-bold">続きから飛ぶ</p>
              <p className="text-xs text-mute">
                {d ? airportDisplayName(d) : leg.destinationCode}まで 残り約{remainingMin}分（推定）· {formatKm(leg.distanceKm * (1 - progress))}
              </p>
            </div>
            <SourceBadge c={{ source: leg.routeSource, carriers: leg.carriers }} />
          </div>
          <ProgressBar value={progress} color="var(--color-gold)" label="区間の進捗" />
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-semibold text-mute">今回の学習時間</p>
            <p className="tabular text-sm text-mute">
              <span className="text-2xl font-bold text-ink" data-testid="ruler-value">
                {minutes}
              </span>{" "}
              分
            </p>
          </div>
          <DurationRuler value={minutes} onChange={setMinutes} />
          <p className="text-xs text-mute">
            {thisTime >= remainingMin ? `今回で ${leg.destinationCode} に到着します（${thisTime}分）。` : `今回は${thisTime}分飛び、あと約${remainingMin - thisTime}分を次回以降に飛びます。`}
          </p>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => run({ plannedMinutes: minutes, resumeLegId: leg.id })}>
            続きの搭乗券を発行
          </Button>
          <button
            type="button"
            className="min-h-11 text-sm text-mute"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "この区間をやめますか？",
                message: `${leg.originCode} に戻った扱いになり、別の行き先を選べます。ここまでの学習記録は残ります。`,
                confirmLabel: "やめて戻る",
                tone: "danger",
              });
              if (ok) await cancelLeg(leg.id).catch((e) => toast(e instanceof Error ? e.message : "取り消せませんでした", "error"));
            }}
          >
            この区間をやめて出発空港に戻る
          </button>
        </div>
      </section>
    </main>
  );
}

/** 地上にいるときの行き先選び */
function ChooseRoute(props: Props & { groundId: string | null }) {
  const prefs = usePreferences();
  const sessions = useSessions();
  const trip = useActiveTrip();
  const { airports, byId } = useAirports();
  const { graph, loading: graphLoading } = useRouteGraph();
  const webgl = useSyncExternalStore(noop, isWebGLAvailable, () => false);
  const [mapFailed, setMapFailed] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [originChoice, setOrigin] = useState<Airport | null>(null);
  const [pick, setPick] = useState<FlightCandidate | null>(null);
  const [manual, setManual] = useState<Airport | null>(null);
  const [tab, setTab] = useState<"fit" | "longer" | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const { busy, run } = useIssue(props);
  const panelRef = useRef<HTMLElement>(null);
  const [panelH, setPanelH] = useState(360);

  const origin = originChoice ?? (props.groundId ? (byId.get(props.groundId) ?? null) : null);
  const final = trip?.finalDestinationId ? (byId.get(trip.finalDestinationId) ?? null) : null;
  const tolerance = { minus: prefs.routeToleranceMinus, plus: prefs.routeTolerancePlus };
  const visited = useMemo(() => new Set(sessions ? visitedAirports(sessions).keys() : []), [sessions]);
  const recent = useMemo(() => {
    const ids: string[] = [];
    for (const s of sessions ?? []) for (const id of [arrivalAirportId(s), s.originAirportId]) if (id && !ids.includes(id)) ids.push(id);
    return ids.map((id) => byId.get(id)).filter((a): a is Airport => !!a).slice(0, 6);
  }, [sessions, byId]);
  const suggested = useMemo(() => SUGGESTED_AIRPORT_IDS.map((id) => byId.get(id)).filter((a): a is Airport => !!a), [byId]);

  const result = useMemo(
    () => (origin ? searchFlights({ origin, studyMinutes: minutes, tolerance, byId, airports, graph, final, includeEstimated: prefs.includeEstimatedRoutes }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tolerance は数値2つから作るので個別に依存させる
    [origin, minutes, tolerance.minus, tolerance.plus, byId, airports, graph, final, prefs.includeEstimatedRoutes],
  );
  const activeTab: "fit" | "longer" = tab ?? (result && result.fit.length === 0 && result.longer.length > 0 ? "longer" : "fit");
  const list = result ? (activeTab === "fit" ? result.fit : result.longer) : [];
  const itinerary = useMemo(() => (graph && origin && final && origin.id !== final.id ? planItinerary(graph, byId, origin.id, final.id) : null), [graph, byId, origin, final]);

  // 選択中の候補（検索条件が変わって候補から外れたら解除。手動選択は維持）
  const selected: FlightCandidate | null = useMemo(() => {
    if (manual && origin) return buildCandidate(origin, manual, graph, minutes, final);
    if (!pick || !result) return null;
    return [...result.fit, ...result.longer].find((c) => c.airport.id === pick.airport.id) ?? null;
  }, [manual, pick, result, origin, minutes, graph, final]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [origin]);

  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    carouselRef.current?.querySelector<HTMLElement>(`[data-airport="${selected.airport.id}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  const choose = (c: FlightCandidate) => {
    setManual(null);
    setPick(c);
  };

  if (!origin) {
    return (
      <main className="px-safe pt-safe mx-auto max-w-xl">
        <div className="mb-5 flex items-center gap-2">
          <button type="button" onClick={props.onBack} aria-label="座席選択に戻る" className="-ml-3 inline-flex size-11 items-center justify-center text-mute">
            <IconChevronLeft />
          </button>
          <h1 className="text-[26px] font-bold">出発する空港</h1>
        </div>
        <p className="mb-4 text-sm text-mute">最初のフライトの出発地を選んでください。着陸した空港が次の出発地になります。</p>
        <AirportCombobox label="出発" value={null} onChange={setOrigin} airports={airports} recent={recent} suggested={suggested} />
      </main>
    );
  }

  const showMap = webgl && !mapFailed;
  const setTol = (minus: number, plus: number) => void updatePreferences({ routeToleranceMinus: Math.max(0, minus), routeTolerancePlus: Math.max(0, plus) });
  const noFit = result && result.fit.length === 0;

  return (
    <main className="relative h-dvh overflow-hidden bg-night">
      {showMap ? (
        <ErrorBoundary fallback={null} onError={() => setMapFailed(true)}>
          <RoutePickerMap
            origin={origin}
            reachKm={activeTab === "fit" ? kmForBlockMinutes(minutes + tolerance.plus) : 0}
            candidates={selected && !list.some((c) => c.airport.id === selected.airport.id) ? [...list, selected] : list}
            selectedId={selected?.airport.id ?? null}
            onSelect={(a) => {
              const c = list.find((x) => x.airport.id === a.id);
              if (c) choose(c);
            }}
            styleId={prefs.mapStyle}
            labels={prefs.mapLabels}
            quality={prefs.renderQuality}
            bottomInset={panelH}
          />
        </ErrorBoundary>
      ) : (
        <div className="absolute inset-0 overflow-y-auto px-4 pt-28" style={{ paddingBottom: panelH + 16 }}>
          {result && <DestinationPicker result={result} studyMinutes={minutes} visited={visited} value={selected?.airport ?? null} onChange={choose} />}
        </div>
      )}

      <header className="px-safe pt-safe pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className="pointer-events-auto flex items-center gap-3">
          <button type="button" onClick={props.onBack} aria-label="座席選択に戻る" className={glassBtn}>
            <IconChevronLeft />
          </button>
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

      <section ref={panelRef} className="px-safe pb-safe absolute inset-x-0 bottom-0 z-10 max-h-[72dvh] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-night/90 pt-3 backdrop-blur-xl" aria-label="時間と行き先">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {/* 最終目的地 */}
          <button type="button" onClick={() => setFinalOpen(true)} className="flex min-h-11 items-center gap-2 rounded-2xl border border-line/70 bg-surface/70 px-3 py-2 text-left">
            <IconTarget size={18} className="shrink-0 text-gold" />
            {final ? (
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-xs text-mute">最終目的地 </span>
                <span className="tabular font-bold text-gold">{airportCodeOf(final)}</span> {airportDisplayName(final)}
                <span className="tabular ml-1 text-xs text-mute">残り {formatKm(haversineKm([origin.lng, origin.lat], [final.lng, final.lat]))}</span>
                {itinerary && itinerary.length > 0 && (
                  <span className="tabular block truncate text-[11px] text-mute">
                    おすすめ経路: {[itinerary[0].from, ...itinerary.map((l) => l.to)].map((a) => airportCodeOf(a)).join(" → ")}（{itinerary.length}区間・約
                    {Math.round(itinerary.reduce((s, l) => s + l.blockMinutes, 0) / 60)}時間・推定）
                  </span>
                )}
                {itinerary === null && graph && <span className="block text-[11px] text-danger">直行便データだけでは到達できません。推定ルートを使ってください。</span>}
              </span>
            ) : (
              <span className="flex-1 text-sm text-mute">最終目的地を決める（任意）</span>
            )}
          </button>

          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-semibold text-mute">集中する時間</p>
            <p className="tabular text-sm text-mute">
              <span className="text-2xl font-bold text-ink" data-testid="ruler-value">
                {minutes}
              </span>{" "}
              分
            </p>
          </div>
          <DurationRuler value={minutes} onChange={setMinutes} />

          <div className="flex items-center justify-between gap-2 text-xs text-mute">
            <span className="tabular">
              検索: {Math.max(0, minutes - tolerance.minus)}〜{minutes + tolerance.plus}分の便
            </span>
            <span className="flex items-center gap-1" role="group" aria-label="許容幅">
              <button type="button" aria-label="許容幅を狭める" className="inline-flex size-9 items-center justify-center rounded-full border border-line" onClick={() => setTol(tolerance.minus - 5, tolerance.plus - 5)}>
                −
              </button>
              <span className="tabular w-14 text-center">±{Math.max(tolerance.minus, tolerance.plus)}分</span>
              <button type="button" aria-label="許容幅を広げる" className="inline-flex size-9 items-center justify-center rounded-full border border-line" onClick={() => setTol(tolerance.minus + 5, tolerance.plus + 5)}>
                +
              </button>
            </span>
          </div>

          {result && (
            <Segmented<"fit" | "longer">
              label="候補の種類"
              value={activeTab}
              onChange={setTab}
              options={[
                { value: "fit", label: `時間に合う ${result.fit.length}` },
                { value: "longer", label: `分割して飛ぶ ${result.longer.length}` },
              ]}
            />
          )}

          {noFit && activeTab === "fit" && (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-xs text-ink" role="status">
              <p className="font-semibold">
                {airportCodeOf(origin)} から {Math.max(0, minutes - tolerance.minus)}〜{minutes + tolerance.plus}分で着ける
                {result!.hasRouteData ? "直行便の就航実績はありません。" : "便は、この空港の路線データにありません。"}
              </p>
              <p className="mt-1 text-mute">旅客便の予定飛行時間は短くても多くが40分以上です。次のどれかを選んでください。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="min-h-9 rounded-full border border-line px-3" onClick={() => setTol(tolerance.minus + 20, tolerance.plus + 20)}>
                  許容幅を±{Math.max(tolerance.minus, tolerance.plus) + 20}分に広げる
                </button>
                {result!.longer.length > 0 && (
                  <button type="button" className="min-h-9 rounded-full border border-line px-3" onClick={() => setTab("longer")}>
                    長い便を分割して飛ぶ（{result!.longer.length}件）
                  </button>
                )}
                {!prefs.includeEstimatedRoutes && (
                  <button type="button" className="min-h-9 rounded-full border border-line px-3" onClick={() => updatePreferences({ includeEstimatedRoutes: true })}>
                    推定ルートも表示する
                  </button>
                )}
              </div>
            </div>
          )}
          {graphLoading && <p className="text-xs text-mute">路線データを読み込み中…</p>}

          <div ref={carouselRef} role="radiogroup" aria-label="行き先の候補" className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {list.slice(0, 40).map((c) => (
              <CandidateCard key={c.airport.id} c={c} selected={selected?.airport.id === c.airport.id} firstVisit={!visited.has(c.airport.id)} onPick={() => choose(c)} />
            ))}
          </div>

          {selected && (
            <p className="text-xs text-mute">
              {selected.blockMinutes <= minutes
                ? `約${selected.blockMinutes}分で ${airportCodeOf(selected.airport)} に到着し、その時点で今回の学習が終わります。`
                : `今回は${minutes}分飛んで上空で止まり、残り約${selected.blockMinutes - minutes}分は次回以降に同じ地点から飛びます（全${selected.sessions}回）。`}
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={!selected || busy}
            onClick={() =>
              selected &&
              run({
                plannedMinutes: minutes,
                origin,
                destination: selected.airport,
                routeSource: selected.source,
                carriers: selected.carriers,
                tripId: trip?.id ?? null,
              })
            }
          >
            {selected ? `${airportCodeOf(selected.airport)} 行きの搭乗券を発行` : "行き先を選んでください"}
          </Button>
        </div>
      </section>

      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="行き先を選ぶ" tall>
        {result && (
          <DestinationPicker
            result={result}
            studyMinutes={minutes}
            visited={visited}
            value={selected?.airport ?? null}
            onChange={(c) => {
              choose(c);
              setListOpen(false);
            }}
          />
        )}
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>
              推定ルートも表示する
              <span className="block text-xs text-mute">直行便データがない空港間も、距離からの推定で候補にします</span>
            </span>
            <input type="checkbox" checked={prefs.includeEstimatedRoutes} onChange={(e) => updatePreferences({ includeEstimatedRoutes: e.target.checked })} className="size-5 accent-sky" />
          </label>
          <p className="text-sm font-semibold">リストにない空港へ飛ぶ</p>
          <AirportCombobox
            label="到着"
            value={manual}
            onChange={(a) => {
              setPick(null);
              setManual(a);
              setListOpen(false);
            }}
            airports={airports}
            recent={recent}
            suggested={suggested}
            exclude={origin.id}
          />
          <p className="text-xs text-mute">直行便データにない組み合わせは「推定ルート」として記録されます。</p>
          <p className="pt-2 text-sm font-semibold">出発地を変える</p>
          <AirportCombobox label="出発" value={originChoice} onChange={(a) => (setOrigin(a), setPick(null), setManual(null))} airports={airports} recent={recent} suggested={suggested} />
          <p className="text-xs text-mute">ふだんは前回着陸した空港から出発します。変えると旅の軌跡はいったん区切られます。</p>
        </div>
      </Sheet>

      <Sheet open={finalOpen} onClose={() => setFinalOpen(false)} title="最終目的地">
        <p className="mb-3 text-sm text-mute">いくつかの空港を経由しながら目指す、旅のゴールを決めます。候補には目的地へどれだけ近づくかが表示されます。</p>
        <AirportCombobox
          label="目的地"
          value={final}
          onChange={async (a) => {
            await setFinalDestination(origin.id, a.id);
            setFinalOpen(false);
          }}
          airports={airports}
          recent={recent}
          suggested={suggested}
          exclude={origin.id}
        />
        {trip && trip.finalDestinationId && (
          <button
            type="button"
            className="mt-4 min-h-11 text-sm text-mute"
            onClick={async () => {
              await abandonTrip(trip.id);
              setFinalOpen(false);
            }}
          >
            最終目的地をやめる
          </button>
        )}
        <p className="mt-4 text-[11px] text-mute/80">
          おすすめ経路は OpenFlights の直行便データ（2014年時点）と推定予定飛行時間から計算しています。 <Link href="/settings/" className="underline">出典</Link>
        </p>
      </Sheet>
    </main>
  );
}
