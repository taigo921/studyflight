// 先行登録。送信先は NEXT_PUBLIC_WAITLIST_ENDPOINT（JSON を POST）。未設定なら受付停止として扱う。
// 送信先（フォームサービス・DB）は未契約のため、利用開始にはユーザーの承認が必要。
import { z } from "zod";
import { getAttribution } from "./attribution";

const ENDPOINT = process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ?? "";

export const PLATFORMS = ["iphone", "android", "pc", "other"] as const;
export const ROLES = ["student_hs", "student_univ", "worker", "other"] as const;

export const WaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  platform: z.enum(PLATFORMS),
  role: z.enum(ROLES),
  agreed: z.literal(true),
  lang: z.enum(["ja", "en"]),
});
export type WaitlistInput = z.input<typeof WaitlistSchema>;

export function waitlistOpen(): boolean {
  return ENDPOINT.length > 0;
}

export type WaitlistError = "invalid_email" | "need_agree" | "closed" | "network";

/** 入力を検証し、送信用の本文を作る（流入元を添える）。 */
export function buildWaitlistPayload(input: WaitlistInput, now = new Date()) {
  const parsed = WaitlistSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false as const, error: (field === "agreed" ? "need_agree" : "invalid_email") as WaitlistError };
  }
  const { first, last } = getAttribution();
  const pick = (t: typeof first) => (t ? { source: t.utm_source, medium: t.utm_medium, campaign: t.utm_campaign, content: t.utm_content, term: t.utm_term, ref: t.ref, landing: t.landingPath } : null);
  return {
    ok: true as const,
    body: { ...parsed.data, submittedAt: now.toISOString(), attribution: { first: pick(first), last: pick(last) } },
  };
}

export async function submitWaitlist(input: WaitlistInput, fetchFn: typeof fetch = fetch, endpoint = ENDPOINT): Promise<{ ok: true } | { ok: false; error: WaitlistError }> {
  if (!endpoint) return { ok: false, error: "closed" };
  const built = buildWaitlistPayload(input);
  if (!built.ok) return built;
  try {
    const res = await fetchFn(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(built.body) });
    return res.ok ? { ok: true } : { ok: false, error: "network" };
  } catch {
    return { ok: false, error: "network" };
  }
}
