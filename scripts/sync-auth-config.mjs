// Firebase Authentication のログイン方法を揃える（匿名 + メール/パスワード）。何度実行しても同じ結果。
// 使い方: GOOGLE_APPLICATION_CREDENTIALS=鍵.json node scripts/sync-auth-config.mjs
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT ?? "study-flight";
const URL = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"] }).getClient();

const { data: cur } = await client.request({ url: URL });
const want = { anonymous: { enabled: true }, email: { enabled: true, passwordRequired: true } };
const ok = cur.signIn?.anonymous?.enabled && cur.signIn?.email?.enabled && cur.signIn?.email?.passwordRequired !== false;
if (ok) {
  console.log("auth config: already up to date (anonymous + email/password)");
} else {
  await client.request({
    url: `${URL}?updateMask=signIn.anonymous.enabled,signIn.email.enabled,signIn.email.passwordRequired`,
    method: "PATCH",
    data: { signIn: want },
  });
  console.log("auth config: enabled anonymous + email/password");
}
const domains = cur.authorizedDomains ?? [];
console.log(`authorized domains: ${domains.join(", ")}`);
