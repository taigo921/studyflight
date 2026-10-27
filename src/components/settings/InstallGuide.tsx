"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconPlus, IconShare } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const noop = () => () => {};
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function StepNo({ n }: { n: number }) {
  return <span className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-xs text-sky">{n}</span>;
}

/** ホーム画面への追加案内。iPhone は「共有 → ホーム画面に追加」を図解する。 */
export function InstallGuide() {
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const ios = useSyncExternalStore(noop, isIOS, () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return <p className="text-sm text-ok">ホーム画面のアプリとして起動しています。</p>;
  if (deferred)
    return (
      <Button onClick={() => deferred.prompt().then(() => setDeferred(null))} className="w-full">
        ホーム画面にインストール
      </Button>
    );
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {ios ? (
        <>
          <li className="flex items-center gap-3">
            <StepNo n={1} />
            <span>
              Safari の <IconShare size={18} className="inline align-text-bottom text-sky" /> 共有ボタンをタップ
            </span>
          </li>
          <li className="flex items-center gap-3">
            <StepNo n={2} />
            <span>
              「<IconPlus size={16} className="inline align-text-bottom" /> ホーム画面に追加」を選ぶ
            </span>
          </li>
          <li className="flex items-center gap-3">
            <StepNo n={3} />
            <span>ホーム画面の StudyFlight アイコンから起動すると、全画面のアプリとして使えます</span>
          </li>
        </>
      ) : (
        <li className="text-mute">ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</li>
      )}
      <li className="text-xs text-mute">注意: Safari と「ホーム画面のアプリ」はデータの保存場所が別です。使う方を決めるか、バックアップで移行してください。</li>
    </ol>
  );
}
