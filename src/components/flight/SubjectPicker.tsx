"use client";

import { useState } from "react";
import { IconCheck, IconPlus } from "@/components/icons/Icons";
import { createSubject, createTask } from "@/data/subjects";
import type { StudyTask, Subject } from "@/domain/types";
import { toast } from "@/store/ui";

function InlineAdd({ placeholder, onAdd, label }: { placeholder: string; label: string; onAdd: (v: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-line px-3.5 text-sm text-mute hover:text-ink">
        <IconPlus size={16} /> {label}
      </button>
    );
  const submit = async () => {
    if (!value.trim()) return setOpen(false);
    try {
      await onAdd(value);
      setValue("");
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "追加できませんでした", "error");
    }
  };
  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        aria-label={placeholder}
        className="min-h-11 flex-1 rounded-2xl border border-sky bg-night px-3 text-ink outline-none"
      />
      <button type="submit" aria-label="追加" className="inline-flex size-11 items-center justify-center rounded-2xl bg-sky text-night">
        <IconCheck />
      </button>
    </form>
  );
}

export function SubjectPicker({ subjects, value, onChange }: { subjects: Subject[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="科目" className="flex flex-wrap gap-2">
      {subjects.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[15px] font-semibold transition-colors"
            style={active ? { borderColor: s.color, background: `${s.color}33`, boxShadow: `inset 0 0 0 1px ${s.color}` } : { borderColor: "var(--color-line)" }}
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </button>
        );
      })}
      <InlineAdd
        label="科目を追加"
        placeholder="科目名（例: 解剖学）"
        onAdd={async (name) => {
          const s = await createSubject(name);
          onChange(s.id);
        }}
      />
    </div>
  );
}

export function TaskPicker({ subjectId, tasks, value, onChange }: { subjectId: string; tasks: StudyTask[]; value: string | null; onChange: (id: string | null) => void }) {
  const todo = tasks.filter((t) => t.status === "todo");
  return (
    <div role="radiogroup" aria-label="タスク" className="flex flex-wrap gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${value === null ? "border-sky bg-sky/15 text-sky" : "border-line text-mute"}`}
      >
        指定しない
      </button>
      {todo.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-11 max-w-full truncate rounded-full border px-3.5 text-sm font-semibold ${value === t.id ? "border-sky bg-sky/15 text-sky" : "border-line text-ink"}`}
        >
          {t.title}
        </button>
      ))}
      <InlineAdd
        label="タスク"
        placeholder="タスク（例: 第3章の演習）"
        onAdd={async (title) => {
          const t = await createTask(subjectId, title);
          onChange(t.id);
        }}
      />
    </div>
  );
}
