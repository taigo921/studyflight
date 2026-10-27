"use client";

// 多言語対応の土台。既定は日本語。アプリ内は設定（preferences.language）、
// 公開ページは ?lang=en または端末内の前回の選択で切り替える。
import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ja, type Messages } from "./ja";

export type Lang = "ja" | "en";
export const LANGS: Lang[] = ["ja", "en"];
const DICT: Record<Lang, Messages> = { ja, en };
const KEY = "sf-lang";

export function isLang(v: unknown): v is Lang {
  return v === "ja" || v === "en";
}

export function messages(lang: Lang): Messages {
  return DICT[lang] ?? ja;
}

const listeners = new Set<() => void>();

/** 現在の言語。URL の ?lang= → 端末内の選択 → 日本語 の順。 */
export function currentLang(): Lang {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "").get("lang");
    if (isLang(q)) return q;
    const saved = globalThis.localStorage?.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* noop */
  }
  return "ja";
}

export function setLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(KEY, lang);
  } catch {
    /* noop */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, currentLang, () => "ja" as Lang);
}

export function useMessages(): Messages {
  return messages(useLang());
}
