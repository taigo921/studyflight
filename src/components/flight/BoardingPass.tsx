import { airportDisplayName } from "@/domain/airport-search";
import { formatKm } from "@/domain/format";
import type { Airport } from "@/domain/types";

export interface BoardingPassData {
  passenger: string;
  flightNo: string;
  subjectName: string;
  subjectColor: string;
  taskTitle?: string | null;
  origin?: Pick<Airport, "name" | "nameJa" | "municipality"> & { code: string };
  destination?: Pick<Airport, "name" | "nameJa" | "municipality"> & { code: string };
  minutes: number;
  seat: string;
  distanceKm?: number;
  status?: string;
}

/** id から決定論的に便名を作る（例: SF 0427）。 */
export function flightNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `SF ${String(h % 9000 + 100).padStart(4, "0")}`;
}

/** 装飾用の疑似バーコード（情報は含まない）。 */
function Barcode({ seed }: { seed: string }) {
  let h = 2166136261;
  const bars: number[] = [];
  for (let i = 0; i < 46; i++) {
    h ^= seed.charCodeAt(i % Math.max(1, seed.length)) + i;
    h = Math.imul(h, 16777619) >>> 0;
    bars.push(1 + (h % 3));
  }
  let x = 0;
  return (
    <svg viewBox="0 0 140 28" className="h-7 w-full" aria-hidden preserveAspectRatio="none">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={28} fill="currentColor" /> : null;
        x += w + 0.6;
        return rect;
      })}
    </svg>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-mute uppercase">{label}</p>
      <p className={`truncate text-[15px] font-semibold ${mono ? "tabular" : ""}`}>{value}</p>
    </div>
  );
}

export function BoardingPass({ data }: { data: BoardingPassData }) {
  const { origin, destination } = data;
  return (
    <article
      aria-label={`搭乗券 ${data.flightNo} ${origin?.code ?? ""}から${destination?.code ?? ""}、${data.subjectName}、${data.minutes}分`}
      className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-b from-elevated to-surface shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold">BOARDING PASS</p>
        <p className="tabular text-xs text-mute">{data.flightNo}</p>
      </div>
      <div className="flex items-center gap-3 px-5 pt-3 pb-4">
        <div className="min-w-0 flex-1">
          <p className="tabular text-[40px] leading-none font-bold tracking-wide">{origin?.code ?? "---"}</p>
          <p className="mt-1 truncate text-xs text-mute">{origin ? airportDisplayName(origin) : "出発地を選択"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center text-sky" aria-hidden>
          <svg width="56" height="20" viewBox="0 0 56 20">
            <path d="M2 16 C 18 2, 38 2, 54 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
            <circle cx="2" cy="16" r="2" fill="currentColor" />
            <circle cx="54" cy="16" r="2" fill="currentColor" />
          </svg>
          {data.distanceKm !== undefined && <span className="tabular text-[10px] text-mute">{formatKm(data.distanceKm)}</span>}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="tabular text-[40px] leading-none font-bold tracking-wide">{destination?.code ?? "---"}</p>
          <p className="mt-1 truncate text-xs text-mute">{destination ? airportDisplayName(destination) : "到着地を選択"}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 px-5 pb-4">
        <Field label="Passenger" value={data.passenger} />
        <Field label="Focus" value={`${data.minutes}分`} mono />
        <Field label="Seat" value={data.seat} mono />
      </div>
      <div className="perforation h-3" aria-hidden />
      <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-5 pt-3 pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-mute uppercase">Subject</p>
          <p className="flex items-center gap-2 truncate text-[15px] font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: data.subjectColor }} aria-hidden />
            {data.subjectName}
          </p>
          {data.taskTitle && <p className="mt-0.5 truncate text-xs text-mute">{data.taskTitle}</p>}
          {data.status && <p className="mt-2 text-xs font-semibold text-sky">{data.status}</p>}
        </div>
        <div className="w-28 text-ink/80">
          <Barcode seed={data.flightNo + data.seat} />
        </div>
      </div>
    </article>
  );
}
