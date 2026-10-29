// Firebase（ソーシャル機能: フレンド・記録の共有・同乗フライト）。
//
// - 設定は環境変数 NEXT_PUBLIC_FIREBASE_*（Firebase の Web 用設定は公開前提の識別子。守りは Firestore のルール）
// - 未設定ならソーシャル機能は表示しない（学習・記録は端末だけで今まで通り動く）
// - SDK は使うときだけ読み込む（初回表示を重くしない）
// - NEXT_PUBLIC_FIREBASE_EMULATOR=1 でローカルのエミュレータにつなぐ（テスト用）

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
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
