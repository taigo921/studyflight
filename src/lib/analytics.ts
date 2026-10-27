// 分析イベント。名前はここで一元管理する（snake_case, 「対象_動詞の過去形」）。
//
// - 同意（consent.ts）があり、送信先（NEXT_PUBLIC_ANALYTICS_ENDPOINT）が設定されているときだけ送る。
//   送信先は未設定（外部サービスは未契約・要承認）。未設定のときは何も保存・送信しない。
// - 個人を特定できる情報・自由記述（メモ、科目名、タスク名、メール）は送らない。値は列挙・数値・真偽のみ。
// - タイマーに影響させない: track() は同期で即座に戻り、例外を投げず、処理は後回しにする。
import { getAttribution } from "./attribution";
import { getConsent, subscribeConsent } from "./consent";
import { newId } from "./id";
import { readJson, removeKey, writeJson } from "./safe-storage";

export const ANALYTICS_EVENTS = {
  /** アプリを開いた（DAU / リテンション） */
  app_opened: "app_opened",
  /** 初回設定を終えた（オンボーディング完了率） */
  onboarding_completed: "onboarding_completed",
  /** 搭乗券を発行した（予約数） */
  boarding_pass_issued: "boarding_pass_issued",
  /** 出発した（開始数） */
  flight_started: "flight_started",
  /** 着陸・学習を終えた（完了率・学習時間） */
  flight_completed: "flight_completed",
  /** 欠航・破棄した（離脱率） */
  flight_abandoned: "flight_abandoned",
  /** 最終目的地を設定した（旅の継続） */
  trip_destination_set: "trip_destination_set",
  /** 共有画像を作った（共有率） */
  share_image_created: "share_image_created",
  /** 共有・保存した */
  share_completed: "share_completed",
  /** 先行登録を送信した（LP 転換率） */
  waitlist_submitted: "waitlist_submitted",
  /** ホーム画面に追加した */
  pwa_installed: "pwa_installed",
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type EventProps = Record<string, string | number | boolean | null | undefined>;

export interface QueuedEvent {
  name: AnalyticsEvent;
  props: Record<string, string | number | boolean | null>;
  at: string;
  anonId: string;
  sessionId: string;
  utm: { source?: string; medium?: string; campaign?: string } | null;
}

const ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ?? "";
const ANON_KEY = "sf-anon-id";
const MAX_STRING = 40;
const queue: QueuedEvent[] = [];
const sessionId = newId();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function analyticsTransportConfigured(): boolean {
  return ENDPOINT.length > 0;
}

/** 値を列挙・数値・真偽だけに絞る（自由記述や長い文字列は捨てる）。 */
export function sanitizeProps(props: EventProps = {}): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(k) || v === undefined) continue;
    if (typeof v === "number") {
      if (Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    } else if (typeof v === "string") {
      if (v.length <= MAX_STRING && /^[A-Za-z0-9_.:-]*$/.test(v)) out[k] = v;
    } else out[k] = v;
  }
  return out;
}

function anonId(): string {
  const saved = readJson<string>(ANON_KEY);
  if (saved) return saved;
  const id = newId();
  writeJson(ANON_KEY, id);
  return id;
}

/** 分析イベントを記録する。同意がなければ何もしない。決して例外を投げない。 */
export function track(name: AnalyticsEvent, props?: EventProps): void {
  try {
    if (!ENDPOINT || getConsent().analytics !== true) return;
    const last = getAttribution().last;
    queue.push({
      name,
      props: sanitizeProps(props),
      at: new Date().toISOString(),
      anonId: anonId(),
      sessionId,
      utm: last ? { source: last.utm_source, medium: last.utm_medium, campaign: last.utm_campaign } : null,
    });
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    scheduleFlush();
  } catch {
    /* 分析の失敗はアプリに影響させない */
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 10_000);
}

/** まとめて送る。オフライン・失敗時は捨てる（再送で端末に溜め込まない）。 */
export function flush(): void {
  if (!ENDPOINT || queue.length === 0 || getConsent().analytics !== true) return;
  const batch = queue.splice(0, queue.length);
  try {
    const body = JSON.stringify({ events: batch });
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* noop */
  }
}

let installed = false;
/** 起動時に一度だけ。画面を離れるときに送信し、同意の取り消しで匿名 ID と未送信分を消す。 */
export function installAnalytics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("appinstalled", () => track("pwa_installed"));
  subscribeConsent(() => {
    if (getConsent().analytics !== true) {
      queue.length = 0;
      removeKey(ANON_KEY);
    }
  });
}

/** テスト用 */
export function pendingEvents(): readonly QueuedEvent[] {
  return queue;
}
