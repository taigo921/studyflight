// Firestore セキュリティルールのテスト。エミュレータ上で実行する: npm run test:rules
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const A = "alice";
const B = "bob";
const C = "carol";
const pair = (x: string, y: string) => (x < y ? `${x}_${y}` : `${y}_${x}`);
const db = (uid: string | null) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const now = new Date("2026-10-29T00:00:00Z");

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-studyflight", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
afterAll(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), path), data));
}

describe("users / friendCodes", () => {
  it("自分のプロフィールだけ作れる。名前とコードの形式を検査", async () => {
    await assertSucceeds(setDoc(doc(db(A), "users", A), { displayName: "あきら", friendCode: "ABCD2345", createdAt: now, updatedAt: now }));
    await assertFails(setDoc(doc(db(A), "users", B), { displayName: "なりすまし", friendCode: "ABCD2346", createdAt: now, updatedAt: now }));
    await assertFails(setDoc(doc(db(A), "users", A), { displayName: "", friendCode: "ABCD2345", createdAt: now, updatedAt: now }));
    await assertFails(setDoc(doc(db(A), "users", A), { displayName: "x", friendCode: "abc", createdAt: now, updatedAt: now }));
    await assertFails(setDoc(doc(db(A), "users", A), { displayName: "x", friendCode: "ABCD2345", email: "a@b.c", createdAt: now, updatedAt: now }));
  });
  it("ログインしていないと読めない。一覧は取れない", async () => {
    await seed(`users/${A}`, { displayName: "あきら", friendCode: "ABCD2345" });
    await assertFails(getDoc(doc(db(null), "users", A)));
    await assertSucceeds(getDoc(doc(db(B), "users", A)));
    await assertFails(getDocs(collection(db(B), "users")));
  });
  it("フレンドコードは自分の uid でだけ作れ、上書きできない", async () => {
    await assertSucceeds(setDoc(doc(db(A), "friendCodes", "ABCD2345"), { uid: A }));
    await assertFails(setDoc(doc(db(B), "friendCodes", "ABCD2345"), { uid: B }));
    await assertFails(setDoc(doc(db(B), "friendCodes", "EFGH2345"), { uid: A }));
    await assertSucceeds(getDoc(doc(db(B), "friendCodes", "ABCD2345")));
    await assertFails(getDocs(collection(db(B), "friendCodes")));
  });
});

describe("friendships", () => {
  const req = (from: string, to: string) => {
    const members = [from, to].sort();
    return { members, requester: from, status: "pending", createdAt: now, updatedAt: now };
  };
  it("申請は自分が含まれる正しい ID でだけ作れる", async () => {
    await assertSucceeds(setDoc(doc(db(A), "friendships", pair(A, B)), req(A, B)));
    await assertFails(setDoc(doc(db(C), "friendships", pair(A, B)), req(A, B)));
    await assertFails(setDoc(doc(db(A), "friendships", "wrong_id"), req(A, B)));
    await assertFails(setDoc(doc(db(A), "friendships", pair(A, C)), { ...req(A, C), status: "accepted" }));
  });
  it("承認は申請された側だけ。申請した側や第三者は承認できない", async () => {
    await seed(`friendships/${pair(A, B)}`, req(A, B));
    await assertFails(updateDoc(doc(db(A), "friendships", pair(A, B)), { status: "accepted", updatedAt: now }));
    await assertFails(updateDoc(doc(db(C), "friendships", pair(A, B)), { status: "accepted", updatedAt: now }));
    await assertFails(updateDoc(doc(db(B), "friendships", pair(A, B)), { status: "accepted", requester: B, updatedAt: now }));
    await assertSucceeds(updateDoc(doc(db(B), "friendships", pair(A, B)), { status: "accepted", updatedAt: now }));
  });
  it("自分の関係だけ一覧でき、どちらからでも解除できる", async () => {
    await seed(`friendships/${pair(A, B)}`, { ...req(A, B), status: "accepted" });
    await assertSucceeds(getDocs(query(collection(db(A), "friendships"), where("members", "array-contains", A))));
    await assertFails(getDocs(query(collection(db(C), "friendships"), where("members", "array-contains", A))));
    await assertFails(deleteDoc(doc(db(C), "friendships", pair(A, B))));
    await assertSucceeds(deleteDoc(doc(db(B), "friendships", pair(A, B))));
  });
});

describe("stats（学習記録の要約）", () => {
  const stats = { displayName: "あきら", updatedAt: now, totals: { focusSeconds: 3600, flights: 2, distanceKm: 500, airports: 3 }, days: { "2026-10-29": 3600 }, recent: [], streakDays: 1, showSubjects: true };
  it("本人だけが書ける", async () => {
    await assertSucceeds(setDoc(doc(db(A), "stats", A), stats));
    await assertFails(setDoc(doc(db(B), "stats", A), stats));
    await assertFails(setDoc(doc(db(A), "stats", A), { ...stats, recent: Array.from({ length: 31 }, () => ({})) }));
  });
  it("公開をやめると本人だけが削除できる", async () => {
    await seed(`stats/${A}`, stats);
    await assertFails(deleteDoc(doc(db(B), "stats", A)));
    await assertSucceeds(deleteDoc(doc(db(A), "stats", A)));
  });
  it("承認済みのフレンドだけが読める（申請中や他人は読めない）", async () => {
    await seed(`stats/${A}`, stats);
    await assertFails(getDoc(doc(db(B), "stats", A)));
    await seed(`friendships/${pair(A, B)}`, { members: [A, B].sort(), requester: A, status: "pending" });
    await assertFails(getDoc(doc(db(B), "stats", A)));
    await seed(`friendships/${pair(A, B)}`, { members: [A, B].sort(), requester: A, status: "accepted" });
    await assertSucceeds(getDoc(doc(db(B), "stats", A)));
    await assertFails(getDoc(doc(db(C), "stats", A)));
  });
});

describe("groups（同乗フライト）", () => {
  const group = { host: A, hostName: "あきら", originId: "RJGG", originCode: "NGO", destinationId: "RJTT", destinationCode: "HND", plannedMinutes: 60, status: "boarding", invited: [B], createdAt: now, departedAt: null };
  const member = (name: string, seat: string) => ({ displayName: name, seat, status: "boarding", focusSeconds: 0, updatedAt: now });
  it("機長として作れる。他人を機長にはできない", async () => {
    await assertSucceeds(setDoc(doc(db(A), "groups", "g1"), group));
    await assertFails(setDoc(doc(db(B), "groups", "g2"), group));
    await assertFails(setDoc(doc(db(A), "groups", "g3"), { ...group, status: "inflight" }));
  });
  it("機長は便と自分の席を 1 回のまとめ書きで作れる", async () => {
    const fdb = db(A);
    const batch = writeBatch(fdb);
    batch.set(doc(fdb, "groups", "g9"), group);
    batch.set(doc(fdb, "groups/g9/members", A), member("あきら", "1A"));
    await assertSucceeds(batch.commit());
  });
  it("出発・取り消しは機長だけ", async () => {
    await seed("groups/g1", group);
    await assertFails(updateDoc(doc(db(B), "groups", "g1"), { status: "inflight" }));
    await assertFails(updateDoc(doc(db(A), "groups", "g1"), { destinationId: "ROAH" }));
    await assertSucceeds(updateDoc(doc(db(A), "groups", "g1"), { status: "inflight", departedAt: now }));
  });
  it("招待された便・自分が機長の便だけ一覧できる", async () => {
    await seed("groups/g1", group);
    await assertSucceeds(getDocs(query(collection(db(B), "groups"), where("invited", "array-contains", B))));
    await assertFails(getDocs(collection(db(C), "groups")));
    await assertSucceeds(getDoc(doc(db(C), "groups", "g1"))); // リンクを知っていれば見られる
  });
  it("自分の座席だけ登録・更新でき、出発後は新しく乗れない", async () => {
    await seed("groups/g1", group);
    await assertSucceeds(setDoc(doc(db(B), "groups/g1/members", B), member("ぼぶ", "12A")));
    await assertFails(setDoc(doc(db(B), "groups/g1/members", C), member("なりすまし", "12B")));
    await assertSucceeds(updateDoc(doc(db(B), "groups/g1/members", B), { status: "active", focusSeconds: 60, updatedAt: now }));
    await assertFails(updateDoc(doc(db(B), "groups/g1/members", B), { status: "teleported", updatedAt: now }));
    await seed("groups/g1", { ...group, status: "inflight" });
    await assertFails(setDoc(doc(db(C), "groups/g1/members", C), member("きゃろる", "3C")));
    await assertSucceeds(getDocs(collection(db(C), "groups/g1/members")));
  });
});
