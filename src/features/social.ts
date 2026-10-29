"use client";

// ソーシャル機能の購読（Firestore の onSnapshot）。Firebase 未設定なら status は "disabled"。
import { useEffect, useState, useSyncExternalStore } from "react";
import type { PublicStats } from "@/domain/public-stats";
import { getProfile, type Friendship, type Group, type GroupMember, type Profile } from "@/data/social";
import { getFirebase, socialConfigured } from "@/lib/firebase";

export type SocialStatus = "disabled" | "loading" | "signedOut" | "needsProfile" | "ready" | "error";
export interface SocialState {
  status: SocialStatus;
  uid: string | null;
  profile: Profile | null;
}

// ログイン状態はアプリ全体で 1 つだけ購読する
let state: SocialState = { status: socialConfigured() ? "loading" : "disabled", uid: null, profile: null };
const listeners = new Set<() => void>();
let started = false;
const SERVER: SocialState = { status: "loading", uid: null, profile: null };

function set(next: SocialState) {
  state = next;
  for (const l of listeners) l();
}

function start() {
  if (started || !socialConfigured()) return;
  started = true;
  void (async () => {
    try {
      const { auth } = await getFirebase();
      const { onAuthStateChanged } = await import("firebase/auth");
      onAuthStateChanged(auth, async (user) => {
        if (!user) return set({ status: "signedOut", uid: null, profile: null });
        try {
          const profile = await getProfile(user.uid);
          set({ status: profile ? "ready" : "needsProfile", uid: user.uid, profile });
        } catch {
          set({ status: "error", uid: user.uid, profile: null });
        }
      });
    } catch {
      set({ status: "error", uid: null, profile: null });
    }
  })();
}

/** プロフィールを作った・変えたあとに呼ぶ */
export function setSocialProfile(profile: Profile) {
  set({ status: "ready", uid: profile.uid, profile });
}

export function useSocial(): SocialState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      start();
      return () => listeners.delete(fn);
    },
    () => state,
    () => SERVER,
  );
}

/** Firestore の購読を React の状態にする小さな共通部品。key が null なら購読しない。 */
function useSnapshot<T>(key: string | null, subscribe: (emit: (v: T) => void, fail: () => void) => Promise<() => void>): T | undefined {
  const [value, setValue] = useState<{ key: string | null; v: T } | undefined>(undefined);
  useEffect(() => {
    if (!key) return;
    let unsub: (() => void) | null = null;
    let alive = true;
    subscribe(
      (v) => alive && setValue({ key, v }),
      () => alive && setValue(undefined),
    )
      .then((u) => (alive ? (unsub = u) : u()))
      .catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
    // subscribe は key ごとに同じ内容なので key だけに依存させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value && value.key === key ? value.v : undefined;
}

export function useFriendships(uid: string | null): Friendship[] | undefined {
  return useSnapshot(uid ? `friendships:${uid}` : null, async (emit, fail) => {
    const { db } = await getFirebase();
    const { collection, onSnapshot, query, where } = await import("firebase/firestore");
    return onSnapshot(
      query(collection(db, "friendships"), where("members", "array-contains", uid)),
      (snap) => emit(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) }))),
      fail,
    );
  });
}

/** uid → 表示名（フレンド一覧・申請の表示用。取得済みはキャッシュ） */
const nameCache = new Map<string, string>();
export function useDisplayNames(uids: string[]): Map<string, string> {
  const key = [...uids].sort().join(",");
  const [names, setNames] = useState<Map<string, string>>(() => new Map(uids.filter((u) => nameCache.has(u)).map((u) => [u, nameCache.get(u)!])));
  useEffect(() => {
    let alive = true;
    const missing = key ? key.split(",").filter((u) => !nameCache.has(u)) : [];
    Promise.all(missing.map((u) => getProfile(u).then((p) => p && nameCache.set(u, p.displayName)).catch(() => {}))).then(() => {
      if (alive) setNames(new Map(key ? key.split(",").filter((u) => nameCache.has(u)).map((u) => [u, nameCache.get(u)!]) : []));
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return names;
}

export function useFriendStats(uid: string | null): PublicStats | null | undefined {
  return useSnapshot(uid ? `stats:${uid}` : null, async (emit, fail) => {
    const { db } = await getFirebase();
    const { doc, onSnapshot } = await import("firebase/firestore");
    return onSnapshot(doc(db, "stats", uid!), (snap) => emit(snap.exists() ? (snap.data() as PublicStats) : null), fail);
  });
}

function toGroup(id: string, d: Record<string, unknown>): Group {
  const departed = d.departedAt as { toDate?: () => Date } | null;
  return { ...(d as unknown as Omit<Group, "id" | "departedAt">), id, departedAt: departed?.toDate?.() ?? null };
}

export function useGroup(gid: string | null): Group | null | undefined {
  return useSnapshot(gid ? `group:${gid}` : null, async (emit, fail) => {
    const { db } = await getFirebase();
    const { doc, onSnapshot } = await import("firebase/firestore");
    return onSnapshot(doc(db, "groups", gid!), (snap) => emit(snap.exists() ? toGroup(snap.id, snap.data()) : null), fail);
  });
}

export function useGroupMembers(gid: string | null): GroupMember[] | undefined {
  return useSnapshot(gid ? `members:${gid}` : null, async (emit, fail) => {
    const { db } = await getFirebase();
    const { collection, onSnapshot } = await import("firebase/firestore");
    return onSnapshot(
      collection(db, "groups", gid!, "members"),
      (snap) =>
        emit(
          snap.docs.map((d) => {
            const v = d.data();
            return { uid: d.id, displayName: v.displayName, seat: v.seat, status: v.status, focusSeconds: v.focusSeconds ?? 0, updatedAt: v.updatedAt?.toDate?.() ?? null } as GroupMember;
          }),
        ),
      fail,
    );
  });
}

/** 自分が招待されている、出発前の同乗フライト */
export function useGroupInvites(uid: string | null): Group[] | undefined {
  return useSnapshot(uid ? `invites:${uid}` : null, async (emit, fail) => {
    const { db } = await getFirebase();
    const { collection, onSnapshot, query, where } = await import("firebase/firestore");
    return onSnapshot(
      query(collection(db, "groups"), where("invited", "array-contains", uid)),
      (snap) => emit(snap.docs.map((d) => toGroup(d.id, d.data())).filter((g) => g.status === "boarding")),
      fail,
    );
  });
}
