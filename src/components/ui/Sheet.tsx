"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "@/components/icons/Icons";
import { useVisualViewportBox } from "@/features/useVisualViewport";

// 見えている範囲からステータスバー分を除いた高さ
const SHEET_MAX = "calc(100% - max(var(--safe-top), 12px) - 8px)";

/**
 * 下からせり上がるモーダル。Esc で閉じ、開いている間は背面をスクロールさせない。
 * キーボード表示中も見えている範囲に収まるよう visualViewport に追従する。
 * tall: 検索リストなど縦に長い内容向けに、ほぼ全画面の高さで開く。
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const box = useVisualViewportBox();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, button:not([data-close])");
    (first ?? ref.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center sm:items-center"
      style={box ? { top: box.top, height: box.height } : undefined}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-fade-up relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-3xl"
        style={tall ? { height: SHEET_MAX } : { maxHeight: SHEET_MAX }}
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" data-close onClick={onClose} aria-label="閉じる" className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-mute hover:text-ink">
              <IconClose />
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? "pb-4" : "pb-safe"}`} data-sheet-body>
          {children}
        </div>
        {footer && <div className="pb-safe shrink-0 border-t border-line bg-surface px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
