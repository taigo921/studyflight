"use client";

// 利用状況データの同意。送信先が設定されているときだけ、未回答の人に一度表示する。
import Link from "next/link";
import { useConsent } from "@/features/useConsent";
import { useMessages } from "@/i18n";
import { analyticsTransportConfigured } from "@/lib/analytics";
import { setAnalyticsConsent } from "@/lib/consent";

export function ConsentBanner() {
  const consent = useConsent();
  const m = useMessages();
  if (!analyticsTransportConfigured() || consent.version === 0 || consent.analytics !== null) return null;
  return (
    <section
      aria-label={m.consent.region}
      className="fixed inset-x-3 z-40 mx-auto max-w-xl rounded-3xl border border-line bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 10px)" }}
    >
      <p className="text-sm font-semibold">{m.consent.title}</p>
      <p className="mt-1 text-xs text-mute">
        {m.consent.body}
        <Link href="/privacy/" className="ml-1 text-sky underline">
          {m.common.privacy}
        </Link>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="min-h-11 rounded-2xl border border-line text-sm font-semibold" onClick={() => setAnalyticsConsent(false)}>
          {m.consent.decline}
        </button>
        <button type="button" className="min-h-11 rounded-2xl bg-sky text-sm font-semibold text-night" onClick={() => setAnalyticsConsent(true)}>
          {m.consent.accept}
        </button>
      </div>
    </section>
  );
}
