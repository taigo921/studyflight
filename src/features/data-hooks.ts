"use client";

// Dexie の liveQuery による購読フック。別タブでの変更も自動で反映される。
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb } from "@/data/db";
import { defaultGoals, defaultPreferences } from "@/data/settings";
import type { FlightSession, FocusSegment, StudyTask, Subject } from "@/domain/types";

export function usePreferences() {
  // undefined = 読み込み中、null = 未作成（初回起動）
  const row = useLiveQuery(async () => (await getDb().preferences.get("default")) ?? null, []);
  return useMemo(() => ({ ...defaultPreferences(), ...(row ?? {}), loaded: row !== undefined }), [row]);
}

export function useGoals() {
  const row = useLiveQuery(() => getDb().goals.get("default"), []);
  return useMemo(() => ({ ...defaultGoals(), ...(row ?? {}) }), [row]);
}

export function useSubjects(includeArchived = false): Subject[] | undefined {
  return useLiveQuery(async () => {
    const all = await getDb().subjects.orderBy("createdAt").toArray();
    return includeArchived ? all : all.filter((s) => !s.archivedAt);
  }, [includeArchived]);
}

export function useTasks(subjectId?: string | null): StudyTask[] | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const rows = subjectId ? await db.tasks.where("subjectId").equals(subjectId).toArray() : await db.tasks.toArray();
    return rows.sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === "todo" ? -1 : 1));
  }, [subjectId ?? ""]);
}

export function useSession(id: string | null | undefined): FlightSession | null | undefined {
  return useLiveQuery(async () => (id ? ((await getDb().sessions.get(id)) ?? null) : null), [id ?? ""]);
}

/** active / paused のフライト（最大1件）。読み込み中は undefined、無ければ null。 */
export function useOpenFlight(): FlightSession | null | undefined {
  return useLiveQuery(async () => (await getDb().sessions.where("status").anyOf("active", "paused").first()) ?? null, []);
}

export function useBoardingFlight(): FlightSession | null | undefined {
  return useLiveQuery(async () => (await getDb().sessions.where("status").equals("boarding").first()) ?? null, []);
}

/** 履歴（boarding 以外）。新しい順。 */
export function useSessions(): FlightSession[] | undefined {
  return useLiveQuery(async () => {
    const rows = await getDb().sessions.where("status").anyOf("completed", "abandoned", "active", "paused").toArray();
    return rows.sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt));
  }, []);
}

export function useSegments(): FocusSegment[] | undefined {
  return useLiveQuery(() => getDb().focusSegments.toArray(), []);
}
