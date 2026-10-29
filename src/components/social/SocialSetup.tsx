"use client";

// ソーシャル機能をはじめる（表示名だけ。匿名でログインする）。
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { setupProfile } from "@/data/social";
import { usePreferences } from "@/features/data-hooks";
import { setSocialProfile } from "@/features/social";
import { toast } from "@/store/ui";
import { LoginForm } from "./AccountForms";

export function SocialSetup({ title = "フレンド機能をはじめる", onDone }: { title?: string; onDone?: () => void }) {
  const prefs = usePreferences();
  const [name, setName] = useState(prefs.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      setSocialProfile(await setupProfile(name));
      onDone?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "はじめられませんでした", "error");
    } finally {
      setBusy(false);
    }
  };
  if (login) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
        <p className="font-bold">保存したアカウントでログイン</p>
        <p className="text-xs text-mute">別の場所（ホーム画面のアプリ・Safari など）で保存したメールとパスワードを入れてください。</p>
        <LoginForm onDone={onDone} />
        <button type="button" className="min-h-11 text-sm text-mute" onClick={() => setLogin(false)}>
          はじめて使う
        </button>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
      <p className="font-bold">{title}</p>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">表示名（フレンドに見える名前）</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="例: たいご"
          className="min-h-12 rounded-2xl border border-line bg-night px-3 text-ink outline-none focus:border-sky"
        />
      </label>
      <ul className="list-disc pl-5 text-xs text-mute">
        <li>メールアドレスなどの登録は不要です（この端末に匿名のアカウントを作ります）。</li>
        <li>フレンドに見えるのは、表示名と学習記録の要約（日別の時間・最近の便）だけです。メモやタスク名は送りません。</li>
        <li>はじめたあと「アカウントを保存」すると、ほかの場所（Safari・ホーム画面のアプリ・別の端末）でも同じアカウントを使えます。</li>
      </ul>
      <Button size="lg" disabled={busy || !name.trim()} onClick={start}>
        はじめる
      </Button>
      <button type="button" className="min-h-11 text-sm font-semibold text-sky" onClick={() => setLogin(true)}>
        アカウントを保存済みの方はログイン
      </button>
    </section>
  );
}
