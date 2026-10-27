"use client";

// FlightLog の共有。サイズと表示項目を選び、端末内で画像を作って保存・共有する。
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { DEFAULT_PRIVACY, renderFlightLog, SHARE_SIZES, type FlightLogData, type ShareFormat, type SharePrivacy } from "@/features/share/flightlog-image";
import { useLang, useMessages } from "@/i18n";
import { track } from "@/lib/analytics";
import { downloadBlob, timestampForFile } from "@/lib/download";
import { toast } from "@/store/ui";

const FORMATS: ShareFormat[] = ["story", "feed", "wide"];

export function ShareSheet({ open, onClose, data }: { open: boolean; onClose: () => void; data: FlightLogData }) {
  const m = useMessages();
  const lang = useLang();
  const [format, setFormat] = useState<ShareFormat>("story");
  const [privacy, setPrivacy] = useState<SharePrivacy>(DEFAULT_PRIVACY);
  const [image, setImage] = useState<{ blob: Blob; url: string; key: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${format}|${privacy.route}|${privacy.subject}|${privacy.date}|${privacy.name}|${lang}`;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    renderFlightLog(data, format, privacy, m, lang)
      .then((blob) => {
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        setFailed(false);
        setImage((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url, key };
        });
        track("share_image_created", { format, show_route: privacy.route, show_subject: privacy.subject, show_date: privacy.date, show_name: privacy.name });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // key に依存すれば十分（data は開いている間は変わらない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  // 閉じたとき・作り直したときに古い画像の URL を解放する
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const ready = image?.key === key ? image : null;
  const filename = `studyflight-${data.originCode}-${data.destinationCode}-${timestampForFile()}.png`;

  const save = () => {
    if (!ready) return;
    downloadBlob(filename, ready.blob);
    track("share_completed", { method: "download", format });
    toast(m.share.saved, "success");
  };

  const share = async () => {
    if (!ready) return;
    const file = new File([ready.blob], filename, { type: "image/png" });
    const payload = { files: [file], text: m.share.shareText };
    try {
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        track("share_completed", { method: "share", format });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 共有シートを閉じただけ
    }
    save();
  };

  const toggle = (k: keyof SharePrivacy, label: string) => (
    <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" checked={privacy[k]} onChange={(e) => setPrivacy((p) => ({ ...p, [k]: e.target.checked }))} className="size-5 accent-sky" />
      {label}
    </label>
  );
  const size = SHARE_SIZES[format];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={m.share.title}
      tall
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" disabled={!ready} onClick={save}>
            {m.share.save}
          </Button>
          <Button size="lg" disabled={!ready} onClick={share}>
            {m.share.shareBtn}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented<ShareFormat> label={m.share.format} value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f, label: m.share.formats[f] }))} />
        <div className="flex justify-center rounded-2xl bg-night/60 p-3">
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ready.url} alt={m.share.preview} data-testid="share-preview" className="max-h-[42dvh] w-auto rounded-xl shadow-lg" style={{ aspectRatio: `${size.w} / ${size.h}` }} />
          ) : (
            <p className="flex items-center text-sm text-mute" style={{ aspectRatio: `${size.w} / ${size.h}`, maxHeight: "42dvh" }}>
              {failed ? m.share.failed : m.share.generating}
            </p>
          )}
        </div>
        <fieldset className="grid grid-cols-2 gap-x-3">
          <legend className="mb-1 text-xs font-semibold text-mute">{m.share.privacy}</legend>
          {toggle("route", m.share.showRoute)}
          {toggle("subject", m.share.showSubject)}
          {toggle("date", m.share.showDate)}
          {data.displayName ? toggle("name", m.share.showName) : null}
        </fieldset>
        <p className="text-xs text-mute">{m.share.note}</p>
      </div>
    </Sheet>
  );
}
