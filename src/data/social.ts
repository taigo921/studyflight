// ソーシャル機能の Firestore 操作。ルールは firestore.rules（エミュレータでテスト済み）。
// ログインは匿名認証（表示名だけで始められる）。学習記録の原本は端末にあり、ここには要約だけを書く。

import type { User } from "firebase/auth";
import type { Airport } from "@/domain/types";
import type { PublicStats } from "@/domain/public-stats";
import { airportCodeOf } from "@/domain/airport-search";
import { getFirebase } from "@/lib/firebase";

export interface Profile {
  uid: string;
  displayName: string;
  friendCode: string;
}

export interface Friendship {
  id: string;
  members: [string, string];
  requester: string;
  status: "pending" | "accepted";
}

export type GroupStatus = "boarding" | "inflight" | "done" | "cancelled";
export interface Group {
  id: string;
  host: string;
  hostName: string;
  originId: string;
  originCode: string;
  destinationId: string;
  destinationCode: string;
  plannedMinutes: number;
  status: GroupStatus;
  invited: string[];
  departedAt: Date | null;
}

export type MemberStatus = "boarding" | "active" | "paused" | "landed" | "left";
export interface GroupMember {
  uid: string;
  displayName: string;
  seat: string;
  status: MemberStatus;
  focusSeconds: number;
  updatedAt: Date | null;
}

const fs = () => import("firebase/firestore");

export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/** 紛らわしい文字（I, O, 0, 1）を除いた 8 文字のフレンドコード */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newFriendCode(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}
export function normalizeFriendCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1").slice(0, 8);
}

export async function currentUser(): Promise<User | null> {
  const { auth } = await getFirebase();
  await auth.authStateReady();
  return auth.currentUser;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const { db } = await getFirebase();
  const { doc, getDoc } = await fs();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { uid, displayName: d.displayName, friendCode: d.friendCode };
}

/** 匿名でログインし、表示名とフレンドコードを登録する（初回だけ）。 */
export async function setupProfile(displayName: string): Promise<Profile> {
  const name = displayName.trim().slice(0, 24);
  if (!name) throw new Error("表示名を入力してください");
  const { auth, db } = await getFirebase();
  const { signInAnonymously } = await import("firebase/auth");
  const { doc, setDoc, serverTimestamp } = await fs();
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const existing = await getProfile(user.uid);
  if (existing) {
    await setDoc(doc(db, "users", user.uid), { displayName: name, friendCode: existing.friendCode, updatedAt: serverTimestamp() }, { merge: true });
    return { ...existing, displayName: name };
  }
  // コードの重複は作成の失敗（既存は上書きできない）で分かるので、別のコードで作り直す
  for (let i = 0; i < 5; i++) {
    const code = newFriendCode();
    try {
      await setDoc(doc(db, "friendCodes", code), { uid: user.uid });
    } catch {
      continue;
    }
    await setDoc(doc(db, "users", user.uid), { displayName: name, friendCode: code, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { uid: user.uid, displayName: name, friendCode: code };
  }
  throw new Error("フレンドコードを作れませんでした。もう一度お試しください");
}

export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  const name = displayName.trim().slice(0, 24);
  if (!name) throw new Error("表示名を入力してください");
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await fs();
  await updateDoc(doc(db, "users", uid), { displayName: name, updatedAt: serverTimestamp() });
}

/** フレンドコードで申請する。相手から申請が来ていれば承認する。 */
export async function addFriendByCode(me: string, rawCode: string): Promise<"requested" | "accepted" | "already"> {
  const code = normalizeFriendCode(rawCode);
  if (code.length !== 8) throw new Error("フレンドコードは8文字です");
  const { db } = await getFirebase();
  const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = await fs();
  const target = await getDoc(doc(db, "friendCodes", code));
  if (!target.exists()) throw new Error("このフレンドコードの人が見つかりません");
  const other = target.data().uid as string;
  if (other === me) throw new Error("自分のフレンドコードです");
  const id = pairId(me, other);
  const ref = doc(db, "friendships", id);
  const cur = await getDoc(ref).catch(() => null);
  if (cur?.exists()) {
    const f = cur.data() as Friendship;
    if (f.status === "accepted") return "already";
    if (f.requester !== me) {
      await updateDoc(ref, { status: "accepted", updatedAt: serverTimestamp() });
      return "accepted";
    }
    return "requested";
  }
  await setDoc(ref, { members: [me, other].sort(), requester: me, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return "requested";
}

export async function acceptFriend(id: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await fs();
  await updateDoc(doc(db, "friendships", id), { status: "accepted", updatedAt: serverTimestamp() });
}

export async function removeFriend(id: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, "friendships", id));
}

export async function publishStats(uid: string, stats: PublicStats): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc } = await fs();
  await setDoc(doc(db, "stats", uid), stats);
}

export async function unpublishStats(uid: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, "stats", uid)).catch(() => {});
}

// ---------------------------------------------------------------------------
// 同乗フライト

export async function createGroup(input: { host: Profile; origin: Airport; destination: Airport; plannedMinutes: number; seat: string; invited: string[] }): Promise<string> {
  const { db } = await getFirebase();
  const { collection, doc, writeBatch, serverTimestamp } = await fs();
  const ref = doc(collection(db, "groups"));
  const batch = writeBatch(db);
  batch.set(ref, {
    host: input.host.uid,
    hostName: input.host.displayName,
    originId: input.origin.id,
    originCode: airportCodeOf(input.origin),
    destinationId: input.destination.id,
    destinationCode: airportCodeOf(input.destination),
    plannedMinutes: input.plannedMinutes,
    status: "boarding",
    invited: input.invited.slice(0, 30),
    createdAt: serverTimestamp(),
    departedAt: null,
  });
  batch.set(doc(db, "groups", ref.id, "members", input.host.uid), { displayName: input.host.displayName, seat: input.seat, status: "boarding", focusSeconds: 0, updatedAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export async function joinGroup(gid: string, me: Profile, seat: string): Promise<void> {
  const { db } = await getFirebase();
  const { doc, setDoc, serverTimestamp } = await fs();
  await setDoc(doc(db, "groups", gid, "members", me.uid), { displayName: me.displayName, seat, status: "boarding", focusSeconds: 0, updatedAt: serverTimestamp() });
}

export async function updateMember(gid: string, uid: string, patch: { status: MemberStatus; focusSeconds: number }): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await fs();
  await updateDoc(doc(db, "groups", gid, "members", uid), { status: patch.status, focusSeconds: Math.round(patch.focusSeconds), updatedAt: serverTimestamp() });
}

export async function setGroupStatus(gid: string, status: GroupStatus): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc, serverTimestamp } = await fs();
  await updateDoc(doc(db, "groups", gid), status === "inflight" ? { status, departedAt: serverTimestamp() } : { status });
}

export async function inviteToGroup(gid: string, invited: string[]): Promise<void> {
  const { db } = await getFirebase();
  const { doc, updateDoc } = await fs();
  await updateDoc(doc(db, "groups", gid), { invited: invited.slice(0, 30) });
}

export function groupLink(gid: string): string {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  return `${base}/group/?id=${encodeURIComponent(gid)}`;
}

export function friendLink(code: string): string {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`;
  return `${base}/friends/?add=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
// アカウントの保存とログイン（メール + パスワード）
// iPhone では LINE の中・Safari・ホーム画面のアプリで保存場所が分かれるため、
// 匿名のアカウントをメールで保存し、別の場所ではログインして同じアカウントを使う。

const AUTH_ERRORS: Record<string, string> = {
  "auth/email-already-in-use": "このメールアドレスはすでに使われています。「ログイン」から入ってください",
  "auth/credential-already-in-use": "このメールアドレスはすでに使われています。「ログイン」から入ってください",
  "auth/invalid-email": "メールアドレスの形が正しくありません",
  "auth/weak-password": "パスワードは6文字以上にしてください",
  "auth/missing-password": "パスワードを入力してください",
  "auth/invalid-credential": "メールアドレスかパスワードが違います",
  "auth/wrong-password": "メールアドレスかパスワードが違います",
  "auth/user-not-found": "メールアドレスかパスワードが違います",
  "auth/too-many-requests": "何度も失敗したため、しばらく待ってからお試しください",
  "auth/network-request-failed": "通信できませんでした。電波の良いところでお試しください",
  "auth/operation-not-allowed": "メールでのログインはまだ準備中です",
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? (e instanceof Error ? e.message : "うまくいきませんでした");
}

/** いまの（匿名の）アカウントにメールとパスワードを付けて保存する。uid・フレンドはそのまま。 */
export async function saveAccountWithEmail(email: string, password: string): Promise<string> {
  const { auth } = await getFirebase();
  const { EmailAuthProvider, linkWithCredential } = await import("firebase/auth");
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("先にフレンド機能をはじめてください");
  const cred = await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email.trim(), password));
  return cred.user.email ?? email.trim();
}

/** 保存したアカウントにログインする（この場所の匿名アカウントから切り替わる）。 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { auth } = await getFirebase();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { auth } = await getFirebase();
  const { sendPasswordResetEmail } = await import("firebase/auth");
  auth.languageCode = "ja";
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutSocial(): Promise<void> {
  const { auth } = await getFirebase();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

/** LINE などアプリ内ブラウザで開いたときに外部ブラウザ（Safari）で開かせる印 */
function external(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}openExternalBrowser=1`;
}
export function shareableGroupLink(gid: string): string {
  return external(groupLink(gid));
}
export function shareableFriendLink(code: string): string {
  return external(friendLink(code));
}
