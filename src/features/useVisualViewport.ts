"use client";

import { useSyncExternalStore } from "react";

// iOS Safari ではキーボード表示中、position: fixed の基準（レイアウトビューポート）は縮まず、
// 見えている範囲（visualViewport）だけが縮んで上にずれる。モーダルをこの範囲に合わせて配置する。

function subscribe(cb: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", cb);
  vv.addEventListener("scroll", cb);
  return () => {
    vv.removeEventListener("resize", cb);
    vv.removeEventListener("scroll", cb);
  };
}

function snapshot(): string {
  const vv = window.visualViewport;
  return vv ? `${Math.round(vv.offsetTop)}:${Math.round(vv.height)}` : "";
}

/** 見えている範囲の { top, height }。visualViewport が無ければ null（通常の fixed 配置で十分）。 */
export function useVisualViewportBox(): { top: number; height: number } | null {
  const s = useSyncExternalStore(subscribe, snapshot, () => "");
  if (!s) return null;
  const [top, height] = s.split(":").map(Number);
  return { top, height };
}
