// 表示用フォーマッタ。秒で保持した値を最後に丸める。

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 例: 0分 / 45分 / 1時間5分 */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export function formatMinutes(totalSeconds: number): string {
  return `${Math.floor(Math.max(0, totalSeconds) / 60)}`;
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("ja-JP")} km`;
}

export function formatPoints(p: number): string {
  return `${Math.round(p).toLocaleString("ja-JP")}`;
}

export function formatDateTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDayLabel(dayKey: string): string {
  const [, m, d] = dayKey.split("-").map(Number);
  return `${m}/${d}`;
}

export function percent(ratio: number): string {
  return `${Math.round(Math.max(0, ratio) * 100)}%`;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["ja"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}
