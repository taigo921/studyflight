// Service Worker の登録と更新導線。新しい版が待機中になったら利用者に知らせる。
import { toast } from "@/store/ui";

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  // 初回インストール時の clients.claim() でも controllerchange は発火するため、
  // 利用者が「更新」を選んだ場合にだけ再読み込みする
  let updateRequested = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested) return;
    updateRequested = false;
    window.location.reload();
  });
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      const promptUpdate = (worker: ServiceWorker) =>
        toast("新しいバージョンがあります", "info", {
          label: "更新",
          onClick: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        });
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) promptUpdate(worker);
        });
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {
      /* オフライン機能なしで続行 */
    });
}
