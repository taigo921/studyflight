// IANA タイムゾーンでの暦日計算。外部ライブラリを使わず Intl で実装する。
// 日キーは "YYYY-MM-DD"（そのタイムゾーンでの暦日）。週は月曜始まり。

export type DayKey = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(ms: number, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** そのタイムゾーンの UTC からのオフセット（ミリ秒）。 */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** タイムゾーンでの壁時計時刻を UTC ミリ秒に変換する（DST 境界でも収束させる）。 */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - tzOffsetMs(guess, tz);
  const second2 = guess - tzOffsetMs(first, tz);
  return second2;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(ms: number, tz: string): DayKey {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function parseDayKey(key: DayKey): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function addDays(key: DayKey, n: number): DayKey {
  const { year, month, day } = parseDayKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0=月曜 … 6=日曜 */
export function weekdayIndex(key: DayKey): number {
  const { year, month, day } = parseDayKey(key);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function weekStart(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function monthKey(key: DayKey): string {
  return key.slice(0, 7);
}

export function startOfDayMs(key: DayKey, tz: string): number {
  const { year, month, day } = parseDayKey(key);
  return zonedToUtc(year, month, day, 0, 0, 0, tz);
}

export function daysBetween(a: DayKey, b: DayKey): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

/** [startMs, endMs) を暦日ごとに分割し、各日の秒数を返す。 */
export function splitIntervalByDay(startMs: number, endMs: number, tz: string): { day: DayKey; seconds: number }[] {
  const result: { day: DayKey; seconds: number }[] = [];
  if (!(endMs > startMs)) return result;
  let cursor = startMs;
  // 安全弁: 異常に長い区間でも無限ループしない
  for (let guard = 0; guard < 4000 && cursor < endMs; guard++) {
    const key = dayKey(cursor, tz);
    const next = startOfDayMs(addDays(key, 1), tz);
    const segEnd = Math.min(endMs, next > cursor ? next : endMs);
    result.push({ day: key, seconds: (segEnd - cursor) / 1000 });
    cursor = segEnd;
  }
  return result;
}
