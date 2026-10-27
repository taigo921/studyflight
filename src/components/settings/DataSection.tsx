"use client";

import { useRef, useState } from "react";
import { IconDownload, IconTrash, IconUpload } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { applyImport, exportBackup, previewImport, sessionsToCsv, wipeAllData, type ImportMode, type ImportPreview } from "@/data/backup";
import { getDb } from "@/data/db";
import { downloadText, timestampForFile } from "@/lib/download";
import { confirmDialog, toast } from "@/store/ui";

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);

  const exportJson = async () => {
    const b = await exportBackup();
    downloadText(`studyflight-backup-${timestampForFile()}.json`, JSON.stringify(b, null, 2), "application/json");
    toast(`バックアップを書き出しました（${b.data.sessions.length}件のフライト）`, "success");
  };

  const exportCsv = async () => {
    const sessions = await getDb().sessions.orderBy("createdAt").toArray();
    downloadText(`studyflight-flights-${timestampForFile()}.csv`, sessionsToCsv(sessions.filter((s) => s.status !== "boarding")), "text/csv");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPreview(await previewImport(await file.text()));
      setMode("merge");
    } catch (e) {
      toast(e instanceof Error ? e.message : "読み込めませんでした", "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = async () => {
    if (!preview) return;
    if (mode === "replace") {
      const ok = await confirmDialog({ title: "端末内のデータを置き換えますか？", message: "現在の記録はすべて消え、バックアップの内容に置き換わります。", confirmLabel: "置き換える", tone: "danger" });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await applyImport(preview.backup, mode);
      toast("バックアップを読み込みました", "success");
      setPreview(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "読み込みに失敗しました", "error");
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const ok = await confirmDialog({
      title: "すべてのデータを削除しますか？",
      message: "科目・フライト記録・目標・設定がこの端末から完全に削除されます。先にバックアップの書き出しをおすすめします。",
      confirmLabel: "完全に削除",
      tone: "danger",
      requireText: "削除",
    });
    if (!ok) return;
    await wipeAllData();
    // DB を空にした後はメモリ上のキャッシュも含めて完全に初期化したいので、意図的にフルリロードする
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/onboarding/");
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-mute">データはこの端末のブラウザ内にだけ保存されています。ブラウザのデータ削除や機種変更で失われるため、定期的にバックアップしてください。</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={exportJson}>
          <IconDownload size={18} /> バックアップ
        </Button>
        <Button variant="secondary" onClick={exportCsv}>
          <IconDownload size={18} /> CSV
        </Button>
      </div>
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        <IconUpload size={18} /> バックアップから復元
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="バックアップファイルを選択" data-testid="import-file" />
      <Button variant="danger" onClick={wipe}>
        <IconTrash size={18} /> すべてのデータを削除
      </Button>

      {preview && (
        <Sheet
          open
          onClose={() => setPreview(null)}
          title="復元の確認"
          footer={
            <Button onClick={runImport} disabled={busy} className="w-full">
              {mode === "merge" ? "統合して復元" : "置き換えて復元"}
            </Button>
          }
        >
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-mute">書き出し日時: {new Date(preview.backup.exportedAt).toLocaleString("ja-JP")}</p>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-mute">
                  <th className="py-1 font-medium">種類</th>
                  <th className="py-1 text-right font-medium">件数</th>
                  <th className="py-1 text-right font-medium">既存と重複</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {(
                  [
                    ["科目", preview.counts.subjects, preview.conflicts.subjects],
                    ["タスク", preview.counts.tasks, preview.conflicts.tasks],
                    ["フライト", preview.counts.sessions, preview.conflicts.sessions],
                  ] as const
                ).map(([label, n, c]) => (
                  <tr key={label} className="border-t border-line/50">
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-right">{n}</td>
                    <td className="py-2 text-right">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.skippedOpenSessions > 0 && <p className="text-gold">この端末で進行中のフライトがあるため、バックアップ内の進行中フライトは取り込みません。</p>}
            <Segmented<ImportMode>
              label="復元方法"
              value={mode}
              onChange={setMode}
              options={[
                { value: "merge", label: "統合" },
                { value: "replace", label: "置き換え" },
              ]}
            />
            <p className="text-xs text-mute">{mode === "merge" ? "同じ記録は更新日時が新しい方を残します。重複して二重計上されることはありません。" : "端末内の記録を削除し、バックアップの内容だけにします。"}</p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
