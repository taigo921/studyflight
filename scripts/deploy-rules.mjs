// firestore.rules を Firebase Rules API で本番に反映する（Firebase CLI を使わない。CLI はサービス有効化の確認に余分な権限が要るため）。
// 使い方: GOOGLE_APPLICATION_CREDENTIALS=鍵.json node scripts/deploy-rules.mjs
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.FIREBASE_PROJECT ?? "study-flight";
const API = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;
const RELEASE = `projects/${PROJECT}/releases/cloud.firestore`;

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"] });
const client = await auth.getClient();
const content = readFileSync("firestore.rules", "utf8");

const ruleset = await client.request({ url: `${API}/rulesets`, method: "POST", data: { source: { files: [{ name: "firestore.rules", content }] } } });
const rulesetName = ruleset.data.name;
console.log(`ruleset: ${rulesetName}`);

try {
  await client.request({ url: `https://firebaserules.googleapis.com/v1/${RELEASE}`, method: "PATCH", data: { release: { name: RELEASE, rulesetName } } });
} catch (e) {
  if (e?.response?.status !== 404) throw e;
  await client.request({ url: `${API}/releases`, method: "POST", data: { name: RELEASE, rulesetName } });
}
console.log(`released: ${RELEASE} -> ${rulesetName}`);
