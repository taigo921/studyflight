"use client";

import { useState } from "react";
import { statusLabel } from "@/components/flight/FlightStub";
import { IconTrash } from "@/components/icons/Icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { correctSession, deleteSession } from "@/data/sessions";
import { airportDisplayName } from "@/domain/airport-search";
import { formatDateTime, formatDuration, formatKm } from "@/domain/format";
import type { FlightSession } from "@/domain/types";
import { useSubjects } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";
import { confirmDialog, toast } from "@/store/ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/50 py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-mute">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export function SessionDetailSheet({ session, timezone, onClose }: { session: FlightSession; timezone: string; onClose: () => void }) {
  const subjects = useSubjects(true);
  const { byId } = useAirports();
  const [note, setNote] = useState(session.note ?? "");
  const [subjectId, setSubjectId] = useState(session.subjectId);
  const st = statusLabel(session);
  const o = byId.get(session.originAirportId);
  const d = byId.get(session.landedAirportId ?? session.destinationAirportId);
  const plannedDest = byId.get(session.destinationAirportId);
  const open = session.status === "active" || session.status === "paused";
  const dirty = note !== (session.note ?? "") || subjectId !== session.subjectId;

  const save = async () => {
    const subject = subjects?.find((s) => s.id === subjectId);
    await correctSession(session.id, { note, subject: subject && subject.id !== session.subjectId ? subject : undefined });
    toast("記録を更新しました", "success");
    onClose();
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: "この記録を削除しますか？",
      message: "削除した記録は元に戻せません。学習時間・ポイント・訪問空港の集計からも除外されます。",
      confirmLabel: "削除する",
      tone: "danger",
    });
    if (!ok) return;
    await deleteSession(session.id);
    toast("記録を削除しました");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${session.originCode} → ${session.landedCode ?? session.destinationCode}`}
      footer={
        open ? (
          <LinkButton href={`/flight/?id=${session.id}`} className="w-full">
            フライトに戻る
          </LinkButton>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button variant="danger" onClick={remove} aria-label="記録を削除">
              <IconTrash size={20} />
            </Button>
            <Button onClick={save} disabled={!dirty}>
              変更を保存
            </Button>
          </div>
        )
      }
    >
      <div className="mb-3">
        <Row label="状態">
          <span className={`font-semibold ${st.tone}`}>{st.text}</span>
        </Row>
        <Row label="出発">
          {o ? airportDisplayName(o) : session.originCode}
          <span className="block text-xs text-mute">{formatDateTime(session.startedAt, timezone)}</span>
        </Row>
        <Row label="到着">
          {d ? airportDisplayName(d) : session.destinationCode}
          <span className="block text-xs text-mute">{formatDateTime(session.completedAt, timezone)}</span>
        </Row>
        {session.landedAirportId && (
          <Row label="当初の目的地">
            <span className="text-gold">{plannedDest ? airportDisplayName(plannedDest) : session.destinationCode}（ダイバート）</span>
          </Row>
        )}
        <Row label="集中時間">
          <span className="tabular font-semibold">{formatDuration(session.actualFocusSeconds ?? session.accumulatedFocusSeconds)}</span>
          <span className="text-mute"> / 予定 {formatDuration(session.plannedSeconds)}</span>
        </Row>
        <Row label="SkyPoints">
          <span className="tabular font-semibold text-gold">{session.earnedSkyPoints}</span>
        </Row>
        <Row label="距離">{formatKm(session.distanceKm)}</Row>
        <Row label="座席">{session.seat}</Row>
        {session.taskTitle && <Row label="タスク">{session.taskTitle}</Row>}
        {session.clockAnomaly && (
          <Row label="注意">
            <span className="text-gold">端末時刻の変更を検知しました</span>
          </Row>
        )}
      </div>
      {!open && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">科目（誤りの修正）</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="min-h-12 rounded-2xl border border-line bg-night px-3 text-ink">
              {!subjects?.some((s) => s.id === session.subjectId) && <option value={session.subjectId}>{session.subjectName}</option>}
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archivedAt ? "（アーカイブ）" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">メモ</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="rounded-2xl border border-line bg-night p-3 text-ink" />
          </label>
          <p className="text-xs text-mute">集中時間とポイントは記録の公正さを保つため編集できません。誤った記録は削除してください。</p>
        </div>
      )}
    </Sheet>
  );
}
