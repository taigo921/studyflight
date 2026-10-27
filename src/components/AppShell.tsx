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
import { installAnalytics, track } from "@/lib/analytics";
import { captureAttribution } from "@/lib/attribution";
import { ConsentBanner } from "./ConsentBanner";
import { currentLang, setLang } from "@/i18n";
import { toast } from "@/store/ui";

const IMMERSIVE = new Set(["/flight", "/arrival", "/onboarding", "/boarding"]);
/** 端末内のデータを使わない公開ページ（先行登録 LP・プライバシーポリシー） */
export const PUBLIC_PATHS = new Set(["/lp", "/privacy"]);

export function AppShell({ children }: { children: ReactNode }) {
  const path = normalizePath(usePathname());
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const prefs = usePreferences();
  const isPublic = PUBLIC_PATHS.has(path);

  // 流入元の記録と分析の準備（どのページから来ても一度だけ）
  useEffect(() => {
    captureAttribution();
    installAnalytics();
  }, []);

  useEffect(() => {
    let alive = true;
    bootstrap()
      .then(({ landed }) => {
        if (!alive) return;
        setState("ready");
        track("app_opened");
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
    if (!prefs.onboardedAt && path !== "/onboarding" && !isPublic) router.replace("/onboarding/");
  }, [state, prefs.loaded, prefs.onboardedAt, path, router, isPublic]);

  // アプリ内の言語は設定に従う（公開ページは ?lang= を優先）
  useEffect(() => {
    if (prefs.loaded && !isPublic && currentLang() !== prefs.language) setLang(prefs.language);
  }, [prefs.loaded, prefs.language, isPublic]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(prefs.reducedMotion);
  }, [prefs.reducedMotion]);

  // 公開ページは端末のデータベースが使えなくても表示する
  if (isPublic) {
    return (
      <>
        <Toaster />
        {children}
      </>
    );
  }

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
      <div className={immersive ? "" : "pb-nav"}>{children}</div>
      {!immersive && <ConsentBanner />}
      {!immersive && <BottomNav />}
      {/* 確認ダイアログは画面内のシートより手前に出す（後に描画する） */}
      <ConfirmHost />
    </>
  );
}
