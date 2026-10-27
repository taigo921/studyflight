"use client";

// 搭乗手続き: 座席 → 科目 → 地図で時間と行き先 → 搭乗券のチェックイン → 出発。
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { glassBtn, RouteStep } from "@/components/boarding/RouteStep";
import { SeatMap, seatKind } from "@/components/boarding/SeatMap";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BoardingPass, flightNumber } from "@/components/flight/BoardingPass";
import { SubjectPicker, TaskPicker } from "@/components/flight/SubjectPicker";
import { IconChevronLeft, IconPlane } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { abandonFlight, departFlight } from "@/data/sessions";
import { ensureUsableSubject } from "@/data/subjects";
import type { FlightSession } from "@/domain/types";
import { dayKey } from "@/domain/zoned";
import { useBoardingFlight, useOpenFlight, usePreferences, useSessions, useSubjects, useTasks } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { isWebGLAvailable } from "@/lib/world";
import { toast } from "@/store/ui";

const RoutePickerMap = dynamic(() => import("@/components/boarding/RoutePickerMap"), { ssr: false, loading: () => null });
const noop = () => () => {};

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
  const subjects = useSubjects();
  const sessions = useSessions();
  const [step, setStep] = useState<"seat" | "route">("seat");
  const [seat, setSeat] = useState<string | null>(null);
  const [seatSeed] = useState(() => dayKey(Date.now(), "UTC"));
  const [subjectSheet, setSubjectSheet] = useState(false);
  const [subjectChoice, setSubjectId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

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

  if (step === "route" && seat && subject) return <RouteStep seat={seat} subject={subject} task={task} onBack={() => setStep("seat")} />;

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
            candidates={[{ airport: d }]}
            selectedId={d.id}
            onSelect={() => {}}
            styleId={prefs.mapStyle}
            labels={prefs.mapLabels}
            quality={prefs.renderQuality}
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
