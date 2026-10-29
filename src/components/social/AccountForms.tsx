"use client";

// アカウントの保存（メール + パスワード）とログイン。LINE・Safari・ホーム画面のアプリで同じアカウントを使うため。
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authErrorMessage, saveAccountWithEmail, sendPasswordReset, signInWithEmail } from "@/data/social";
import { setSocialEmail } from "@/features/social";
import { toast } from "@/store/ui";

const field = "min-h-12 rounded-2xl border border-line bg-night px-3 text-ink outline-none focus:border-sky";

function EmailPassword({ email, setEmail, password, setPassword, newPassword }: { email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; newPassword?: boolean }) {
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">メールアドレス</span>
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">パスワード{newPassword ? "（6文字以上）" : ""}</span>
        <input type="password" autoComplete={newPassword ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
    </>
  );
}

/** いまのアカウントをメールで保存する */
export function SaveAccountForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          setSocialEmail(await saveAccountWithEmail(email, password));
          toast("アカウントを保存しました。ほかの場所ではこのメールでログインできます", "success");
        } catch (err) {
          toast(authErrorMessage(err), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <EmailPassword email={email} setEmail={setEmail} password={password} setPassword={setPassword} newPassword />
      <Button type="submit" disabled={busy || !email || password.length < 6}>
        アカウントを保存
      </Button>
    </form>
  );
}

/** 保存したアカウントでログインする */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await signInWithEmail(email, password);
          toast("ログインしました", "success");
          onDone?.();
        } catch (err) {
          toast(authErrorMessage(err), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <EmailPassword email={email} setEmail={setEmail} password={password} setPassword={setPassword} />
      <Button type="submit" disabled={busy || !email || !password}>
        ログイン
      </Button>
      <button
        type="button"
        className="min-h-11 text-xs text-sky"
        onClick={async () => {
          if (!email) return toast("メールアドレスを入力してください", "error");
          try {
            await sendPasswordReset(email);
            toast("パスワードを再設定するメールを送りました", "success");
          } catch (err) {
            toast(authErrorMessage(err), "error");
          }
        }}
      >
        パスワードを忘れたとき
      </button>
    </form>
  );
}
