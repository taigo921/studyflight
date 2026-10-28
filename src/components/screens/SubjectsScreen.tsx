"use client";

import { useState } from "react";
import { IconArchive, IconCheck, IconEdit, IconPlus, IconTrash } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { addSubjectSet, createSubject, createTask, DENTAL_SUBJECTS, deleteTask, setSubjectArchived, setTaskDone, SUBJECT_COLORS, updateSubject } from "@/data/subjects";
import type { Subject } from "@/domain/types";
import { useSubjects, useTasks } from "@/features/data-hooks";
import { confirmDialog, toast } from "@/store/ui";

function SubjectEditor({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const [name, setName] = useState(subject?.name ?? "");
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [taskTitle, setTaskTitle] = useState("");
  const tasks = useTasks(subject?.id ?? "__none__");

  const save = async () => {
    try {
      if (subject) await updateSubject(subject.id, { name, color });
      else await createSubject(name, color);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存できませんでした", "error");
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={subject ? "科目を編集" : "科目を追加"}
      footer={
        <Button onClick={save} className="w-full" disabled={!name.trim()}>
          保存
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">科目名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="min-h-12 rounded-2xl border border-line bg-night px-4 text-ink outline-none focus:border-sky" data-autofocus />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">色</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="色">
            {SUBJECT_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`色 ${i + 1}`}
                onClick={() => setColor(c)}
                className="inline-flex size-11 items-center justify-center rounded-full"
                style={{ background: c, boxShadow: color === c ? "0 0 0 3px var(--color-night), 0 0 0 5px var(--color-ink)" : undefined }}
              >
                {color === c && <IconCheck size={18} className="text-white" />}
              </button>
            ))}
          </div>
        </fieldset>
        {subject && tasks && (
          <div>
            <p className="mb-2 text-sm font-semibold">タスク</p>
            <ul className="flex flex-col gap-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <label className="flex min-h-11 flex-1 items-center gap-3">
                    <input type="checkbox" checked={t.status === "done"} onChange={(e) => setTaskDone(t.id, e.target.checked)} className="size-5 accent-sky" />
                    <span className={t.status === "done" ? "text-mute line-through" : ""}>{t.title}</span>
                  </label>
                  <button type="button" aria-label={`${t.title}を削除`} onClick={() => deleteTask(t.id)} className="inline-flex size-11 items-center justify-center text-mute hover:text-danger">
                    <IconTrash size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                await createTask(subject.id, taskTitle);
                setTaskTitle("");
              }}
            >
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="新しいタスク" maxLength={80} aria-label="新しいタスク" className="min-h-11 flex-1 rounded-2xl border border-line bg-night px-3 text-ink outline-none focus:border-sky" />
              <button type="submit" aria-label="タスクを追加" className="inline-flex size-11 items-center justify-center rounded-2xl bg-elevated text-sky">
                <IconPlus />
              </button>
            </form>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function SubjectsScreen() {
  const all = useSubjects(true);
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const active = all?.filter((s) => !s.archivedAt) ?? [];
  const archived = all?.filter((s) => s.archivedAt) ?? [];
  const activeNames = new Set(active.map((s) => s.name));
  const missingDental = DENTAL_SUBJECTS.filter((n) => !activeNames.has(n));

  const addDental = async () => {
    try {
      const n = await addSubjectSet(DENTAL_SUBJECTS);
      toast(`歯学の科目を${n}件追加しました`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "追加できませんでした", "error");
    }
  };

  const archive = async (s: Subject) => {
    const ok = await confirmDialog({
      title: `「${s.name}」をアーカイブしますか？`,
      message: "搭乗手続きの選択肢から外れます。過去の記録や統計はそのまま残り、いつでも戻せます。",
      confirmLabel: "アーカイブ",
    });
    if (ok) await setSubjectArchived(s.id, true);
  };

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader
        title="科目とタスク"
        back="/settings/"
        action={
          <Button onClick={() => setEditing("new")} aria-label="科目を追加">
            <IconPlus size={20} /> 追加
          </Button>
        }
      />
      <div className="flex flex-col gap-5">
        {all && missingDental.length > 0 && (
          <Card className="flex flex-col gap-3">
            <div>
              <p className="font-semibold">歯学の科目をまとめて追加</p>
              <p className="mt-1 text-xs text-mute">
                {missingDental.slice(0, 6).join("・")}
                {missingDental.length > 6 ? ` ほか${missingDental.length - 6}科目` : ""}。すでにある科目は追加しません。
              </p>
            </div>
            <Button variant="secondary" onClick={addDental}>
              <IconPlus size={20} /> {missingDental.length}科目を追加
            </Button>
          </Card>
        )}
        <Card className="p-2">
          <ul className="divide-y divide-line/50">
            {active.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate py-3 font-semibold">{s.name}</span>
                <button type="button" aria-label={`${s.name}を編集`} onClick={() => setEditing(s)} className="inline-flex size-11 items-center justify-center rounded-full text-mute hover:text-ink">
                  <IconEdit size={20} />
                </button>
                <button type="button" aria-label={`${s.name}をアーカイブ`} onClick={() => archive(s)} className="inline-flex size-11 items-center justify-center rounded-full text-mute hover:text-ink">
                  <IconArchive size={20} />
                </button>
              </li>
            ))}
            {active.length === 0 && <li className="p-4 text-sm text-mute">有効な科目がありません。次の搭乗時に「自由学習」が自動で用意されます。</li>}
          </ul>
        </Card>
        {archived.length > 0 && (
          <section>
            <SectionTitle>アーカイブ済み</SectionTitle>
            <ul className="flex flex-col gap-2">
              {archived.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line/60 px-4">
                  <span className="size-3 rounded-full opacity-50" style={{ background: s.color }} aria-hidden />
                  <span className="flex-1 py-3 text-mute">{s.name}</span>
                  <button type="button" onClick={() => setSubjectArchived(s.id, false)} className="min-h-11 text-sm text-sky">
                    戻す
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {editing && <SubjectEditor key={editing === "new" ? "new" : editing.id} subject={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </main>
  );
}
