import type { StudyTask, Subject } from "@/domain/types";
import { newId } from "@/lib/id";
import { getDb } from "./db";

// 暗背景 (#111D33) で CVD・コントラスト検証済みのカテゴリ配色。順番に割り当てる（巡回しない前提で8色）
export const SUBJECT_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] as const;

export const SAMPLE_SUBJECTS = ["生理学", "生化学", "微生物学", "歯科保存学", "口腔外科学", "歯科補綴学", "その他"];
export const FREE_STUDY_NAME = "自由学習";

const now = () => new Date().toISOString();

export function normalizeSubjectName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 40);
}

export async function createSubject(name: string, color?: string): Promise<Subject> {
  const clean = normalizeSubjectName(name);
  if (!clean) throw new Error("科目名を入力してください");
  const db = getDb();
  const count = await db.subjects.count();
  const t = now();
  const subject: Subject = {
    id: newId(),
    name: clean,
    color: color ?? SUBJECT_COLORS[count % SUBJECT_COLORS.length],
    archivedAt: null,
    createdAt: t,
    updatedAt: t,
  };
  await db.subjects.add(subject);
  return subject;
}

export async function updateSubject(id: string, patch: Partial<Pick<Subject, "name" | "color">>): Promise<void> {
  const update: Partial<Subject> = { ...patch, updatedAt: now() };
  if (patch.name !== undefined) {
    update.name = normalizeSubjectName(patch.name);
    if (!update.name) throw new Error("科目名を入力してください");
  }
  await getDb().subjects.update(id, update);
}

/** 物理削除ではなくアーカイブ。過去フライトのラベルは sessions 側のスナップショットで残る。 */
export async function setSubjectArchived(id: string, archived: boolean): Promise<void> {
  await getDb().subjects.update(id, { archivedAt: archived ? now() : null, updatedAt: now() });
}

export async function seedSubjects(names: string[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.subjects, async () => {
    const existing = new Set((await db.subjects.toArray()).map((s) => s.name));
    let i = await db.subjects.count();
    for (const name of names) {
      const clean = normalizeSubjectName(name);
      if (!clean || existing.has(clean)) continue;
      const t = now();
      await db.subjects.add({ id: newId(), name: clean, color: SUBJECT_COLORS[i++ % SUBJECT_COLORS.length], archivedAt: null, createdAt: t, updatedAt: t });
      existing.add(clean);
    }
  });
}

/** 有効な科目が1つもない場合に「自由学習」を自動提供する。 */
export async function ensureUsableSubject(): Promise<Subject> {
  const db = getDb();
  const active = (await db.subjects.toArray()).filter((s) => !s.archivedAt);
  if (active.length > 0) return active[0];
  return createSubject(FREE_STUDY_NAME);
}

export async function createTask(subjectId: string, title: string, estimatedMinutes?: number): Promise<StudyTask> {
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) throw new Error("タスク名を入力してください");
  const t = now();
  const task: StudyTask = { id: newId(), subjectId, title: clean, status: "todo", estimatedMinutes, createdAt: t, completedAt: null, updatedAt: t };
  await getDb().tasks.add(task);
  return task;
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const t = now();
  await getDb().tasks.update(id, { status: done ? "done" : "todo", completedAt: done ? t : null, updatedAt: t });
}

export async function deleteTask(id: string): Promise<void> {
  await getDb().tasks.delete(id);
}
