import { describe, expect, it } from "vitest";
import { effectivePlan, FREE, hasFeature, OFFLINE_TRUST_MS, type Entitlement } from "../entitlements";

const now = Date.parse("2026-10-28T00:00:00Z");
const plus = (patch: Partial<Entitlement> = {}): Entitlement => ({ plan: "plus", source: "stripe", expiresAt: "2026-11-28T00:00:00Z", issuedAt: "2026-10-27T00:00:00Z", ...patch });

describe("entitlements", () => {
  it("無料は有料機能を使えない", () => {
    expect(effectivePlan(FREE, now)).toBe("free");
    expect(hasFeature(null, "cloud_sync", now)).toBe(false);
  });
  it("有効期限内の有料プラン", () => {
    expect(effectivePlan(plus(), now)).toBe("plus");
    expect(hasFeature(plus(), "premium_imagery", now)).toBe(true);
  });
  it("期限切れは無料、猶予期間中は有料のまま", () => {
    expect(effectivePlan(plus({ expiresAt: "2026-10-27T12:00:00Z" }), now)).toBe("free");
    expect(effectivePlan(plus({ expiresAt: "2026-10-27T12:00:00Z", graceUntil: "2026-10-30T00:00:00Z" }), now)).toBe("plus");
  });
  it("サーバーの確認が古すぎる・未来の発行時刻は信用しない", () => {
    expect(effectivePlan(plus({ issuedAt: new Date(now - OFFLINE_TRUST_MS - 1000).toISOString() }), now)).toBe("free");
    expect(effectivePlan(plus({ issuedAt: "2026-10-29T00:00:00Z" }), now)).toBe("free");
    expect(effectivePlan(plus({ issuedAt: "invalid" }), now)).toBe("free");
  });
  it("期限なしの有料（プロモーション等）", () => {
    expect(effectivePlan(plus({ expiresAt: null, source: "promo" }), now)).toBe("plus");
  });
});
