// 利用状況データ（分析）の同意。端末内にのみ保存する。未回答は null。
import { readJson, writeJson } from "./safe-storage";

export const CONSENT_VERSION = 1;
const KEY = "sf-consent";

export interface ConsentState {
  analytics: boolean | null;
  version: number;
  decidedAt: string | null;
}

const listeners = new Set<() => void>();
let cache: ConsentState | null = null;

export function getConsent(): ConsentState {
  if (cache) return cache;
  const saved = readJson<ConsentState>(KEY);
  // 方針の版が変わったら聞き直す
  cache = saved && saved.version === CONSENT_VERSION ? saved : { analytics: null, version: CONSENT_VERSION, decidedAt: null };
  return cache;
}

export function setAnalyticsConsent(granted: boolean, now = new Date()): void {
  cache = { analytics: granted, version: CONSENT_VERSION, decidedAt: now.toISOString() };
  writeJson(KEY, cache);
  for (const l of listeners) l();
}

export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** テスト用 */
export function resetConsentCache(): void {
  cache = null;
}
