// 流入元（UTM パラメータ・紹介コード）の記録。最初の流入（first）と最新の流入（last）を端末内に保存する。
// 送信はしない。分析イベントや先行登録フォームに、同意があるときだけ添える。
import { readJson, writeJson } from "./safe-storage";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export interface Touch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** 紹介コード（?ref=） */
  ref?: string;
  /** 着地ページのパス（クエリなし） */
  landingPath: string;
  at: string;
}

export interface Attribution {
  first: Touch | null;
  last: Touch | null;
}

const KEY = "sf-attribution";
const MAX_LEN = 100;

/** URL のクエリから流入元を取り出す。UTM も ref も無ければ null。 */
export function parseTouch(url: URL, now: Date): Touch | null {
  const t: Touch = { landingPath: url.pathname, at: now.toISOString() };
  let found = false;
  for (const k of UTM_KEYS) {
    const v = clean(url.searchParams.get(k));
    if (v) {
      t[k] = v;
      found = true;
    }
  }
  const ref = clean(url.searchParams.get("ref"));
  if (ref && /^[A-Za-z0-9_-]{1,40}$/.test(ref)) {
    t.ref = ref;
    found = true;
  }
  return found ? t : null;
}

function clean(v: string | null): string | undefined {
  const s = v?.trim().slice(0, MAX_LEN);
  // 制御文字やメールアドレスらしき値（個人情報）は記録しない
  if (!s || /[\u0000-\u001f]/.test(s) || /@/.test(s)) return undefined;
  return s;
}

export function mergeAttribution(prev: Attribution, touch: Touch | null): Attribution {
  if (!touch) return prev;
  return { first: prev.first ?? touch, last: touch };
}

export function getAttribution(): Attribution {
  return readJson<Attribution>(KEY) ?? { first: null, last: null };
}

/** 起動時に一度呼ぶ。 */
export function captureAttribution(href: string = globalThis.location?.href ?? "", now = new Date()): Attribution {
  try {
    const next = mergeAttribution(getAttribution(), parseTouch(new URL(href), now));
    writeJson(KEY, next);
    return next;
  } catch {
    return getAttribution();
  }
}
