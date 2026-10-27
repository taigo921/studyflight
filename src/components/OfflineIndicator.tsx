"use client";

import { useSyncExternalStore } from "react";
import { IconWifiOff } from "@/components/icons/Icons";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function OfflineIndicator() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={{ top: "calc(var(--safe-top) + 6px)" }}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/90 px-3 py-1 text-xs text-mute shadow">
        <IconWifiOff size={14} /> オフライン — 記録は端末に保存されます
      </span>
    </div>
  );
}
