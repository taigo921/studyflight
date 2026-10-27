"use client";

import { useUI } from "@/store/ui";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-up pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            t.tone === "error" ? "border-danger/50 bg-[#2a1520]/95 text-danger" : t.tone === "success" ? "border-ok/40 bg-[#10261f]/95 text-ok" : "border-line bg-elevated/95 text-ink"
          }`}
        >
          <p className="flex-1">{t.message}</p>
          {t.action && (
            <button
              type="button"
              className="min-h-9 rounded-xl px-3 font-semibold text-sky"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
