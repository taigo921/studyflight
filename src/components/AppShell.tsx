"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { ConfirmHost } from "./ui/ConfirmDialog";
import { Toaster } from "./ui/Toaster";
import { BrandMark } from "./BrandMark";
import { usePreferences } from "@/features/data-hooks";
import { bootstrap, normalizePath } from "@/lib/boot";
import { resolveDueFlights } from "@/data/sessions";
import { registerServiceWorker } from "@/lib/sw-register";
import { toast } from "@/store/ui";

const IMMERSIVE = new Set(["/flight", "/arrival", "/onboarding"]);

export function AppShell({ children }: { children: ReactNode }) {
  const path = normalizePath(usePathname());
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const prefs = usePreferences();

  useEffect(() => {
    let alive = true;
    bootstrap()
      .then(({ landed }) => {
        if (!alive) return;
        setState("ready");
        if (landed.length > 0) {
          const s = landed[0];
          toast(`${s.originCode} → ${s.destinationCode} は予定時刻に着陸しました`, "success", { label: "記録を見る", onClick: () => router.push(`/arrival/?id=${s.id}`) });
        }
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });
    registerServiceWorker();
    const onVisible = () => {
      if (document.visibilityState === "visible") void resolveDueFlights().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  // 初回はオンボーディングへ
  useEffect(() => {
    if (state !== "ready" || !prefs.loaded) return;
    if (!prefs.onboardedAt && path !== "/onboarding") router.replace("/onboarding/");
  }, [state, prefs.loaded, prefs.onboardedAt, path, router]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(prefs.reducedMotion);
  }, [prefs.reducedMotion]);

  if (state === "error") {
    return (
      <main className="px-safe pt-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
        <BrandMark size={56} />
        <h1 className="text-xl font-bold">データベースを開けませんでした</h1>
        <p className="text-sm text-mute">
          プライベートブラウズ中、またはストレージが無効になっている可能性があります。通常モードの Safari で開くか、ホーム画面に追加したアプリから起動してください。
        </p>
        <p className="text-xs break-all text-mute/70">{error}</p>
        <button type="button" className="min-h-11 rounded-2xl bg-sky px-5 font-semibold text-night" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </main>
    );
  }

  const redirecting = state === "ready" && (!prefs.loaded || (!prefs.onboardedAt && path !== "/onboarding"));
  if (state === "loading" || redirecting) {
    return (
      <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-mute">
          <BrandMark size={56} />
          <span className="text-sm">準備中…</span>
        </div>
      </main>
    );
  }

  const immersive = IMMERSIVE.has(path);
  return (
    <>
      <OfflineIndicator />
      <Toaster />
      <ConfirmHost />
      <div className={immersive ? "" : "pb-nav"}>{children}</div>
      {!immersive && <BottomNav />}
    </>
  );
}
