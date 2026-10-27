// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeAttribution, parseTouch } from "../attribution";
import { getConsent, resetConsentCache, setAnalyticsConsent } from "../consent";
import { sanitizeProps } from "../analytics";

const now = new Date("2026-10-28T00:00:00Z");

describe("attribution", () => {
  it("UTM と紹介コードを取り出す", () => {
    const t = parseTouch(new URL("https://x.test/lp/?utm_source=tiktok&utm_medium=social&utm_campaign=beta&ref=ABC_12&foo=1"), now);
    expect(t).toMatchObject({ utm_source: "tiktok", utm_medium: "social", utm_campaign: "beta", ref: "ABC_12", landingPath: "/lp/" });
  });
  it("流入情報がなければ null、メールアドレスらしき値や不正な ref は捨てる", () => {
    expect(parseTouch(new URL("https://x.test/?a=1"), now)).toBeNull();
    const t = parseTouch(new URL("https://x.test/?utm_source=me@example.com&utm_medium=x&ref=<script>"), now);
    expect(t?.utm_source).toBeUndefined();
    expect(t?.ref).toBeUndefined();
    expect(t?.utm_medium).toBe("x");
  });
  it("最初の流入は保持し、最新の流入を更新する", () => {
    const a = parseTouch(new URL("https://x.test/?utm_source=x"), now)!;
    const b = parseTouch(new URL("https://x.test/?utm_source=ig"), now)!;
    const m = mergeAttribution(mergeAttribution({ first: null, last: null }, a), b);
    expect(m.first?.utm_source).toBe("x");
    expect(m.last?.utm_source).toBe("ig");
    expect(mergeAttribution(m, null)).toBe(m);
  });
});

describe("analytics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    localStorage.clear();
    resetConsentCache();
  });
  it("自由記述・長い文字列・不正なキーを送らない", () => {
    expect(sanitizeProps({ minutes: 25.456, source: "route", subject_name: "数学", note: "a".repeat(80), "Bad-Key": 1, ok: true, none: undefined })).toEqual({
      minutes: 25.46,
      source: "route",
      ok: true,
    });
  });
  it("同意がなければ記録しない。同意すると送信待ちに入る（送信先が設定されている場合）", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "https://collect.example/e");
    const consent = await import("../consent");
    consent.resetConsentCache();
    const a = await import("../analytics");
    a.track("app_opened");
    expect(a.pendingEvents()).toHaveLength(0);
    consent.setAnalyticsConsent(true, now);
    a.track("flight_completed", { focus_minutes: 25, note: "秘密のメモ" });
    expect(a.pendingEvents()).toHaveLength(1);
    expect(a.pendingEvents()[0].props).toEqual({ focus_minutes: 25 });
  });
  it("送信先が未設定なら同意があっても何もしない", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "");
    const consent = await import("../consent");
    consent.setAnalyticsConsent(true, now);
    const a = await import("../analytics");
    a.track("app_opened");
    expect(a.analyticsTransportConfigured()).toBe(false);
    expect(a.pendingEvents()).toHaveLength(0);
  });
});

describe("consent", () => {
  it("未回答は null、保存した選択を読み戻す", () => {
    resetConsentCache();
    localStorage.clear();
    expect(getConsent().analytics).toBeNull();
    setAnalyticsConsent(false, now);
    resetConsentCache();
    expect(getConsent()).toMatchObject({ analytics: false, decidedAt: now.toISOString() });
  });
});

describe("waitlist", () => {
  it("メールと同意を検証し、流入元を添える", async () => {
    const { buildWaitlistPayload } = await import("../waitlist");
    const { captureAttribution } = await import("../attribution");
    localStorage.clear();
    captureAttribution("https://x.test/lp/?utm_source=tiktok&utm_campaign=beta", now);
    const ok = buildWaitlistPayload({ email: " Me@Example.com ", platform: "iphone", role: "student_univ", agreed: true, lang: "ja" }, now);
    expect(ok.ok && ok.body.email).toBe("me@example.com");
    expect(ok.ok && ok.body.attribution.first?.source).toBe("tiktok");
    expect(buildWaitlistPayload({ email: "nope", platform: "iphone", role: "other", agreed: true, lang: "ja" })).toEqual({ ok: false, error: "invalid_email" });
    expect(buildWaitlistPayload({ email: "a@b.co", platform: "iphone", role: "other", agreed: false as true, lang: "ja" })).toEqual({ ok: false, error: "need_agree" });
  });
  it("送信先が未設定なら受付停止、失敗はネットワークエラー", async () => {
    const { submitWaitlist } = await import("../waitlist");
    const input = { email: "a@b.co", platform: "pc", role: "worker", agreed: true, lang: "en" } as const;
    expect(await submitWaitlist(input, fetch, "")).toEqual({ ok: false, error: "closed" });
    const calls: RequestInit[] = [];
    const fake = (async (_u: unknown, init?: RequestInit) => (calls.push(init!), new Response(null, { status: 201 }))) as typeof fetch;
    expect(await submitWaitlist(input, fake, "https://form.example/w")).toEqual({ ok: true });
    expect(JSON.parse(String(calls[0].body))).toMatchObject({ email: "a@b.co", platform: "pc", lang: "en" });
    const bad = (async () => new Response(null, { status: 500 })) as typeof fetch;
    expect(await submitWaitlist(input, bad, "https://form.example/w")).toEqual({ ok: false, error: "network" });
  });
});
