// 一時的な UI 状態のみ（トースト・確認ダイアログ）。永続データは Dexie が真実源。
import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** 入力一致を求める（全削除など） */
  requireText?: string;
  resolve: (ok: boolean) => void;
}

interface UIState {
  toasts: Toast[];
  confirm: ConfirmRequest | null;
  pushToast: (message: string, tone?: ToastTone, action?: Toast["action"], durationMs?: number) => void;
  dismissToast: (id: number) => void;
  askConfirm: (req: Omit<ConfirmRequest, "resolve">) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let seq = 0;

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  confirm: null,
  pushToast: (message, tone = "info", action, durationMs = 3600) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
    if (durationMs > 0) setTimeout(() => get().dismissToast(id), durationMs);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  askConfirm: (req) =>
    new Promise<boolean>((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { ...req, resolve } });
    }),
  closeConfirm: (ok) => {
    const c = get().confirm;
    set({ confirm: null });
    c?.resolve(ok);
  },
}));

export const toast = (message: string, tone?: ToastTone, action?: Toast["action"]) => useUI.getState().pushToast(message, tone, action);
export const confirmDialog = (req: Omit<ConfirmRequest, "resolve">) => useUI.getState().askConfirm(req);
