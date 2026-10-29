"use client";

// LINE などアプリの中のブラウザで開いたときの案内。そこで作ったアカウントは Safari やホーム画面のアプリと別になるため。
import { useSyncExternalStore } from "react";

const noop = () => () => {};

export function inAppBrowserName(ua: string): string | null {
  if (/\bLine\//i.test(ua)) return "LINE";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/\bTwitter\b/i.test(ua)) return "X";
  return null;
}

export function InAppBrowserNotice() {
  const name = useSyncExternalStore(noop, () => inAppBrowserName(navigator.userAgent), () => null);
  if (!name) return null;
  return (
    <div role="alert" className="mb-4 rounded-2xl border border-gold/50 bg-gold/10 p-3 text-sm">
      <p className="font-bold text-gold">{name} の中で開いています</p>
      <p className="mt-1 text-xs text-ink">
        ここで始めると、Safari やホーム画面のアプリとは別のアカウントになります。右下（または右上）の「…」から<b>「ブラウザで開く」</b>を選んで、Safari で開き直してください。
      </p>
    </div>
  );
}
