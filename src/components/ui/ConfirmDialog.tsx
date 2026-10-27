"use client";

import { useState } from "react";
import { useUI } from "@/store/ui";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

export function ConfirmHost() {
  const req = useUI((s) => s.confirm);
  const close = useUI((s) => s.closeConfirm);
  return req ? <ConfirmDialog key={req.title + (req.message ?? "")} req={req} close={close} /> : null;
}

function ConfirmDialog({ req, close }: { req: NonNullable<ReturnType<typeof useUI.getState>["confirm"]>; close: (ok: boolean) => void }) {
  const [text, setText] = useState("");
  const blocked = !!req.requireText && text.trim() !== req.requireText;
  return (
    <Sheet open onClose={() => close(false)} title={req.title}>
      {req.message && <p className="mb-4 text-[15px] whitespace-pre-line text-mute">{req.message}</p>}
      {req.requireText && (
        <label className="mb-4 block text-sm text-mute">
          確認のため「{req.requireText}」と入力してください
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-night px-4 text-ink"
            autoComplete="off"
            data-autofocus
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => close(false)}>
          {req.cancelLabel ?? "キャンセル"}
        </Button>
        <Button variant={req.tone === "danger" ? "danger" : "primary"} disabled={blocked} onClick={() => close(true)}>
          {req.confirmLabel ?? "OK"}
        </Button>
      </div>
    </Sheet>
  );
}
