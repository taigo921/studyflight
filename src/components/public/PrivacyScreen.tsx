"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { useMessages } from "@/i18n";
import { LangSwitch } from "./LangSwitch";

export function PrivacyScreen() {
  const m = useMessages();
  return (
    <main className="px-safe pt-safe pb-safe mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/lp/" className="flex items-center gap-2 font-bold">
          <BrandMark size={28} /> StudyFlight
        </Link>
        <LangSwitch />
      </header>
      <div>
        <h1 className="text-2xl font-bold">{m.privacy.title}</h1>
        <p className="mt-1 text-xs text-mute">{m.privacy.updated}</p>
      </div>
      {m.privacy.sections.map((s) => (
        <section key={s.h} className="flex flex-col gap-2">
          <h2 className="font-bold">{s.h}</h2>
          <p className="text-sm leading-relaxed text-mute">{s.p}</p>
        </section>
      ))}
      <Link href="/" className="min-h-11 text-sm font-semibold text-sky">
        {m.common.openApp} →
      </Link>
    </main>
  );
}
