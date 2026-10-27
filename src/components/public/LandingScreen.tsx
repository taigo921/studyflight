"use client";

// 先行登録 LP。端末内のデータは使わない。送信先が未設定なら受付停止の表示にする。
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/BrandMark";
import { PLANE_PATH } from "@/components/flight/PlaneGlyph";
import { buttonClass } from "@/components/ui/Button";
import { useLang, useMessages } from "@/i18n";
import { track } from "@/lib/analytics";
import { PLATFORMS, ROLES, submitWaitlist, waitlistOpen, type WaitlistError } from "@/lib/waitlist";
import { LangSwitch } from "./LangSwitch";

/** 地球の縁と航路のイラスト（オリジナル） */
function HeroArt() {
  return (
    <svg viewBox="0 0 360 220" className="h-auto w-full max-w-md" aria-hidden>
      <defs>
        <radialGradient id="lp-earth" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#2a5ea8" />
          <stop offset="55%" stopColor="#0f2547" />
          <stop offset="100%" stopColor="#07101F" />
        </radialGradient>
        <linearGradient id="lp-route" x1="0" x2="1">
          <stop offset="0%" stopColor="#EBC77B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#EBC77B" />
        </linearGradient>
      </defs>
      <ellipse cx="180" cy="330" rx="300" ry="200" fill="url(#lp-earth)" stroke="#66B3FF" strokeOpacity="0.45" />
      <path d="M40 170 Q 180 40 320 150" fill="none" stroke="url(#lp-route)" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
      <circle cx="40" cy="170" r="5" fill="#EBC77B" />
      <circle cx="320" cy="150" r="5" fill="#F6F8FF" />
      <g transform="translate(206 76) rotate(18) translate(-14 -14)">
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d={PLANE_PATH} fill="#F6F8FF" transform="rotate(90 12 12)" />
        </svg>
      </g>
    </svg>
  );
}

function WaitlistForm() {
  const m = useMessages().lp;
  const lang = useLang();
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("iphone");
  const [role, setRole] = useState<(typeof ROLES)[number]>("student_univ");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<WaitlistError | null>(null);
  const open = waitlistOpen();
  const privacyLabel = useMessages().common.privacy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const r = await submitWaitlist({ email, platform, role, agreed: agreed as true, lang });
    if (r.ok) {
      track("waitlist_submitted", { platform, role });
      setStatus("done");
    } else {
      setError(r.error);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <p role="status" className="rounded-2xl border border-ok/40 bg-ok/10 p-4 text-sm text-ok">
        {m.done}
      </p>
    );
  }
  const errorText = error === "invalid_email" ? m.invalidEmail : error === "need_agree" ? m.needAgree : error === "closed" ? m.closed : error === "network" ? m.error : null;
  const field = "min-h-12 rounded-2xl border border-line bg-night px-3 text-ink outline-none focus:border-sky disabled:opacity-60";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-describedby={open ? undefined : "waitlist-closed"}>
      {!open && (
        <p id="waitlist-closed" className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
          {m.closed}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">{m.email}</span>
        <input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={!open} className={field} placeholder="you@example.com" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">{m.platform}</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} disabled={!open} className={field}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {m.platforms[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">{m.role}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} disabled={!open} className={field}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {m.roles[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={!open} className="size-5 accent-sky" />
        <span>
          {m.agree}{" "}
          <Link href="/privacy/" className="whitespace-nowrap text-sky underline">
            {privacyLabel}
          </Link>
        </span>
      </label>
      {errorText && open && (
        <p role="alert" className="text-sm text-danger">
          {errorText}
        </p>
      )}
      <button type="submit" disabled={!open || status === "sending"} className={buttonClass("gold", "lg", "w-full")}>
        {status === "sending" ? m.submitting : m.submit}
      </button>
    </form>
  );
}

export function LandingScreen() {
  const m = useMessages();
  const lp = m.lp;
  return (
    <main className="relative overflow-hidden">
      <div className="earth-arc" aria-hidden />
      <div className="px-safe pt-safe relative mx-auto flex max-w-3xl flex-col gap-14 pb-10">
        <header className="flex items-center justify-between gap-3 pt-3">
          <span className="flex items-center gap-2 text-lg font-bold">
            <BrandMark size={30} /> StudyFlight
          </span>
          <LangSwitch />
        </header>

        <section className="flex flex-col items-center gap-6 text-center">
          <p className="rounded-full border border-gold/40 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-gold">{lp.eyebrow}</p>
          <h1 className="text-[34px] leading-tight font-bold whitespace-pre-line sm:text-5xl">{lp.heroTitle}</h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-mute">{lp.heroBody}</p>
          <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
            <a href="#waitlist" className={buttonClass("gold", "lg", "flex-1")}>
              {lp.ctaPrimary}
            </a>
            <Link href="/" className={buttonClass("secondary", "lg", "flex-1")}>
              {lp.ctaSecondary}
            </Link>
          </div>
          <HeroArt />
        </section>

        <section aria-labelledby="lp-features" className="flex flex-col gap-4">
          <h2 id="lp-features" className="text-xl font-bold">
            {lp.featuresTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {lp.features.map((f) => (
              <li key={f.title} className="rounded-3xl border border-line/70 bg-surface/80 p-4">
                <p className="font-bold">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="lp-how" className="flex flex-col gap-4">
          <h2 id="lp-how" className="text-xl font-bold">
            {lp.howTitle}
          </h2>
          <ol className="grid gap-2 sm:grid-cols-4">
            {lp.how.map((h, i) => (
              <li key={h} className="flex items-center gap-3 rounded-2xl border border-line/60 bg-night/50 p-3 text-sm">
                <span className="tabular inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sky/15 font-bold text-sky">{i + 1}</span>
                {h}
              </li>
            ))}
          </ol>
        </section>

        <section id="waitlist" aria-labelledby="lp-form" className="scroll-mt-6 rounded-3xl border border-line bg-surface/90 p-5">
          <h2 id="lp-form" className="text-xl font-bold">
            {lp.formTitle}
          </h2>
          <p className="mt-1 mb-4 text-sm text-mute">{lp.formBody}</p>
          <WaitlistForm />
        </section>

        <footer className="flex flex-col gap-2 border-t border-line/60 pt-5 text-xs text-mute">
          <p>{lp.footer}</p>
          <Link href="/privacy/" className="min-h-11 py-3 text-sky">
            {m.common.privacy}
          </Link>
        </footer>
      </div>
    </main>
  );
}
