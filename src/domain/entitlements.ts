// 利用権（無料 / 有料）の判定。課金は未実装。
//
// 方針:
// - 課金状態はサーバーが決める（Stripe の Webhook / Apple App Store Server Notifications を検証した結果）。
//   クライアントは「サーバーが発行した利用権」を受け取って表示を切り替えるだけで、自分で有料機能を解放しない。
// - Web（Stripe）と iOS アプリ（Apple の App 内課金）は購入経路を分ける。iOS アプリ内で Web 決済へ誘導しない等、
//   各ストアの規約に従う。どちらで買っても同じ利用権（Entitlement）に正規化する。
// - 学習の記録・タイマーなどの基本機能は無料のまま。利用権が切れてもデータは消さない。

export type Plan = "free" | "plus";
export type PurchaseSource = "stripe" | "apple" | "promo";

export type Feature =
  /** 高解像度の衛星画像（有料の配信元を契約した場合） */
  | "premium_imagery"
  /** 複数端末の同期 */
  | "cloud_sync"
  /** 共有画像の追加デザイン */
  | "share_themes"
  /** 詳細な分析（期間比較など） */
  | "advanced_insights";

export interface Entitlement {
  plan: Plan;
  source: PurchaseSource | null;
  /** 有効期限（ISO）。null は期限なし（無料・永久） */
  expiresAt: string | null;
  /** 支払い失敗時などの猶予期限 */
  graceUntil?: string | null;
  /** サーバーが発行した時刻。古すぎる利用権は使わない */
  issuedAt: string;
}

export const FREE: Entitlement = { plan: "free", source: null, expiresAt: null, issuedAt: "1970-01-01T00:00:00.000Z" };

const PLAN_FEATURES: Record<Plan, readonly Feature[]> = {
  free: [],
  plus: ["premium_imagery", "cloud_sync", "share_themes", "advanced_insights"],
};

/** オフラインでも、サーバーの確認からこの期間は利用権を信用する */
export const OFFLINE_TRUST_MS = 7 * 24 * 60 * 60 * 1000;

/** 現在有効なプラン。期限切れ・猶予切れ・確認が古すぎる場合は free。 */
export function effectivePlan(e: Entitlement | null | undefined, nowMs: number): Plan {
  if (!e || e.plan === "free") return "free";
  const issued = Date.parse(e.issuedAt);
  if (!Number.isFinite(issued) || nowMs - issued > OFFLINE_TRUST_MS || issued - nowMs > 5 * 60_000) return "free";
  const limit = Math.max(e.expiresAt ? Date.parse(e.expiresAt) : Infinity, e.graceUntil ? Date.parse(e.graceUntil) : -Infinity);
  return nowMs <= limit ? e.plan : "free";
}

export function hasFeature(e: Entitlement | null | undefined, feature: Feature, nowMs: number): boolean {
  return PLAN_FEATURES[effectivePlan(e, nowMs)].includes(feature);
}
