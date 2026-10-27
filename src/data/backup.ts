// JSON バックアップ / 復元、CSV エクスポート。インポートは Zod で検証し、
// 実行前にプレビュー（件数・ID 衝突）を返す。PRODUCT_SPEC §10。

import { z } from "zod";
import type { FlightSession, FocusSegment, StudyTask, Subject } from "@/domain/types";
import { getDb, SCHEMA_VERSION } from "./db";
import { defaultGoals, defaultPreferences } from "./settings";

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid date");
const isoNullable = iso.nullable().optional();

const SubjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  color: z.string().max(32),
  icon: z.string().optional(),
  archivedAt: isoNullable,
  createdAt: iso,
  updatedAt: iso,
});

const TaskSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().min(1).max(200),
  status: z.enum(["todo", "done"]),
  estimatedMinutes: z.number().optional(),
  createdAt: iso,
  completedAt: isoNullable,
  updatedAt: iso,
});

const SessionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["boarding", "active", "paused", "completed", "abandoned"]),
  subjectId: z.string().min(1),
  subjectName: z.string(),
  subjectColor: z.string(),
  taskId: z.string().nullable().optional(),
  taskTitle: z.string().nullable().optional(),
  originAirportId: z.string().min(1),
  destinationAirportId: z.string().min(1),
  originCode: z.string(),
  destinationCode: z.string(),
  seat: z.string(),
  plannedSeconds: z.number().int().positive().max(24 * 3600),
  startedAt: isoNullable,
  activeSince: isoNullable,
  accumulatedFocusSeconds: z.number().min(0),
  pausedAt: isoNullable,
  completedAt: isoNullable,
  actualFocusSeconds: z.number().min(0).nullable().optional(),
  completionType: z.enum(["on_time", "early"]).nullable().optional(),
  abandonmentReason: z.string().nullable().optional(),
  distanceKm: z.number().min(0),
  earnedSkyPoints: z.number().int().min(0),
  note: z.string().max(5000).optional(),
  clockAnomaly: z.boolean().optional(),
  createdAt: iso,
  updatedAt: iso,
});

const SegmentSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  startedAt: iso,
  endedAt: iso.nullable(),
  durationSeconds: z.number().min(0),
});

const GoalsSchema = z.object({
  dailyFocusMinutes: z.number().int().min(0).max(1440),
  weeklyFocusMinutes: z.number().int().min(0).max(10080),
  minimumStreakMinutes: z.number().int().min(1).max(1440),
  timezone: z.string().min(1),
});

const PreferencesSchema = z
  .object({
    displayName: z.string().max(40).optional(),
    homeAirportId: z.string().optional(),
    soundMode: z.enum(["off", "cabin", "rain", "white_noise"]),
    reducedMotion: z.boolean(),
    mapMode: z.enum(["auto", "3d", "2d"]),
    onboardedAt: isoNullable,
    earlyLandingMinSeconds: z.number().int().min(0).max(3600).optional(),
  })
  .partial();

export const BackupSchema = z.object({
  app: z.literal("studyflight"),
  schemaVersion: z.number().int().min(1),
  exportedAt: iso,
  data: z.object({
    subjects: z.array(SubjectSchema),
    tasks: z.array(TaskSchema).default([]),
    sessions: z.array(SessionSchema),
    focusSegments: z.array(SegmentSchema).default([]),
    goals: GoalsSchema.optional(),
    preferences: PreferencesSchema.optional(),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(): Promise<Backup> {
  const db = getDb();
  const [subjects, tasks, sessions, focusSegments, goals, preferences] = await Promise.all([
    db.subjects.toArray(),
    db.tasks.toArray(),
    db.sessions.toArray(),
    db.focusSegments.toArray(),
    db.goals.get("default"),
    db.preferences.get("default"),
  ]);
  const strip = <T extends { id?: string; updatedAt?: string }>(row: T | undefined) => {
    if (!row) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, updatedAt, ...rest } = row;
    return rest;
  };
  return {
    app: "studyflight",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      subjects,
      tasks,
      sessions: sessions.map((s) => ({ ...s })),
      focusSegments,
      goals: strip(goals) as Backup["data"]["goals"],
      preferences: strip(preferences) as Backup["data"]["preferences"],
    },
  };
}

export interface ImportPreview {
  backup: Backup;
  counts: { subjects: number; tasks: number; sessions: number; focusSegments: number };
  conflicts: { subjects: number; tasks: number; sessions: number };
  skippedOpenSessions: number;
  orphanSegments: number;
}

export type ImportMode = "merge" | "replace";

export class ImportValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`バックアップファイルの形式が正しくありません: ${issues.slice(0, 3).join(" / ")}`);
    this.name = "ImportValidationError";
  }
}

export function parseBackup(text: string): Backup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportValidationError(["JSON として読み込めません"]);
  }
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success) throw new ImportValidationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const b = parsed.data;
  const dup = (arr: { id: string }[]) => arr.length !== new Set(arr.map((x) => x.id)).size;
  if (dup(b.data.subjects) || dup(b.data.sessions) || dup(b.data.tasks) || dup(b.data.focusSegments)) {
    throw new ImportValidationError(["ファイル内に重複した ID があります"]);
  }
  const openCount = b.data.sessions.filter((s) => s.status === "active" || s.status === "paused").length;
  if (openCount > 1) throw new ImportValidationError(["進行中のフライトが複数含まれています"]);
  return b;
}

export async function previewImport(text: string): Promise<ImportPreview> {
  const backup = parseBackup(text);
  const db = getDb();
  const has = async (table: { bulkGet(keys: string[]): Promise<unknown[]> }, ids: string[]) => (await table.bulkGet(ids)).filter(Boolean).length;
  const localOpen = await db.sessions.where("status").anyOf("active", "paused").count();
  const sessionIds = new Set(backup.data.sessions.map((s) => s.id));
  return {
    backup,
    counts: {
      subjects: backup.data.subjects.length,
      tasks: backup.data.tasks.length,
      sessions: backup.data.sessions.length,
      focusSegments: backup.data.focusSegments.length,
    },
    conflicts: {
      subjects: await has(db.subjects, backup.data.subjects.map((s) => s.id)),
      tasks: await has(db.tasks, backup.data.tasks.map((s) => s.id)),
      sessions: await has(db.sessions, backup.data.sessions.map((s) => s.id)),
    },
    skippedOpenSessions: localOpen > 0 ? backup.data.sessions.filter((s) => s.status === "active" || s.status === "paused").length : 0,
    orphanSegments: backup.data.focusSegments.filter((s) => !sessionIds.has(s.sessionId)).length,
  };
}

/**
 * インポートを実行する。
 * - merge: 同じ ID は updatedAt が新しい方を採用。端末側に進行中フライトがあれば、
 *   インポート側の進行中フライトは取り込まない（同時 open は最大1件）。
 * - replace: 端末内データをすべて置き換える。
 */
export async function applyImport(backup: Backup, mode: ImportMode): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.subjects, db.tasks, db.sessions, db.focusSegments, db.goals, db.preferences], async () => {
    if (mode === "replace") {
      await Promise.all([db.subjects.clear(), db.tasks.clear(), db.sessions.clear(), db.focusSegments.clear()]);
    }
    const mergeRows = async <T extends { id: string; updatedAt: string }>(table: { get(id: string): Promise<T | undefined>; put(row: T): Promise<unknown> }, rows: T[]) => {
      for (const row of rows) {
        const cur = await table.get(row.id);
        if (!cur || cur.updatedAt <= row.updatedAt) await table.put(row);
      }
    };
    await mergeRows(db.subjects, backup.data.subjects as Subject[]);
    await mergeRows(db.tasks, backup.data.tasks as StudyTask[]);

    const localOpen = await db.sessions.where("status").anyOf("active", "paused").first();
    const sessions = (backup.data.sessions as FlightSession[]).filter((s) => {
      if (s.status === "boarding") return false;
      const open = s.status === "active" || s.status === "paused";
      return !(open && localOpen && localOpen.id !== s.id);
    });
    await mergeRows(db.sessions, sessions);
    const imported = new Set(sessions.map((s) => s.id));
    const segments = (backup.data.focusSegments as FocusSegment[]).filter((s) => imported.has(s.sessionId));
    for (const sid of imported) await db.focusSegments.where("sessionId").equals(sid).delete();
    await db.focusSegments.bulkPut(segments);

    if (backup.data.goals) await db.goals.put({ ...defaultGoals(), ...backup.data.goals, id: "default", updatedAt: new Date().toISOString() });
    if (backup.data.preferences) {
      const cur = (await db.preferences.get("default")) ?? defaultPreferences();
      await db.preferences.put({ ...cur, ...backup.data.preferences, id: "default", updatedAt: new Date().toISOString() });
    }
  });
}

export async function wipeAllData(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", [db.subjects, db.tasks, db.sessions, db.focusSegments, db.goals, db.preferences], async () => {
    await Promise.all([db.subjects.clear(), db.tasks.clear(), db.sessions.clear(), db.focusSegments.clear(), db.goals.clear(), db.preferences.clear()]);
  });
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // CSV インジェクション対策: 数式として解釈され得る先頭文字をエスケープ
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function sessionsToCsv(sessions: FlightSession[]): string {
  const header = ["id", "status", "subject", "task", "origin", "destination", "planned_min", "focus_sec", "focus_min", "completion", "distance_km", "sky_points", "started_at", "completed_at", "note"];
  const rows = sessions.map((s) => [
    s.id,
    s.status,
    s.subjectName,
    s.taskTitle ?? "",
    s.originCode,
    s.destinationCode,
    s.plannedSeconds / 60,
    s.actualFocusSeconds ?? "",
    s.actualFocusSeconds != null ? Math.floor(s.actualFocusSeconds / 60) : "",
    s.completionType ?? "",
    s.distanceKm,
    s.earnedSkyPoints,
    s.startedAt ?? "",
    s.completedAt ?? "",
    s.note ?? "",
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}
