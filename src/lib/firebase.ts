// Firebase（ソーシャル機能: フレンド・記録の共有・同乗フライト）。
//
// - 設定は下の DEFAULTS（公開版）か環境変数 NEXT_PUBLIC_FIREBASE_*。Web 用設定は公開前提の識別子で、守りは Firestore のルール
// - 学習・記録は今まで通り端末だけで動き、ソーシャル機能を使うときだけ Firebase につなぐ
// - SDK は使うときだけ読み込む（初回表示を重くしない）
// - NEXT_PUBLIC_FIREBASE_EMULATOR=1 でローカルのエミュレータにつなぐ（テスト用）

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

// 公開版の Firebase プロジェクト（study-flight）の Web 用設定。環境変数があればそちらを使う
const DEFAULTS = {
  apiKey: "AIzaSyDA-bZj7TUIMhV59b3mcW141gTNxbcMukE",
  authDomain: "study-flight.firebaseapp.com",
  projectId: "study-flight",
  appId: "1:900990822401:web:97c9f0128254c621c47800",
};
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULTS.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULTS.appId,
};
const EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

export function socialConfigured(): boolean {
  return !!(config.apiKey && config.projectId && config.appId);
}

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: Promise<FirebaseHandles> | null = null;

export function getFirebase(): Promise<FirebaseHandles> {
  if (!socialConfigured()) return Promise.reject(new Error("social features are not configured"));
  handles ??= (async () => {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
    const app = initializeApp(config);
    const auth = authMod.initializeAuth(app, { persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence] });
    // iPhone の通信環境でも切れにくいよう、必要に応じてロングポーリングに切り替える
    const db = fsMod.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    if (EMULATOR) {
      authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      fsMod.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
    return { app, auth, db };
  })();
  handles.catch(() => (handles = null));
  return handles;
}
