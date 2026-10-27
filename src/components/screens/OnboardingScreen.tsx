"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { AirportCombobox } from "@/components/flight/AirportCombobox";
import { IconCheck, IconPlus } from "@/components/icons/Icons";
import { Button } from "@/components/ui/Button";
import { SUGGESTED_AIRPORT_IDS } from "@/data/core-airports";
import { updatePreferences } from "@/data/settings";
import { ensureUsableSubject, SAMPLE_SUBJECTS, seedSubjects } from "@/data/subjects";
import type { Airport } from "@/domain/types";
import { useAirports } from "@/features/useAirports";
import { toast } from "@/store/ui";

const STEPS = ["ようこそ", "科目", "ホーム空港"];

export function OnboardingScreen() {
  const router = useRouter();
  const { airports, byId } = useAirports();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>(SAMPLE_SUBJECTS.slice(0, 3));
  const [custom, setCustom] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [home, setHome] = useState<Airport | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const suggested = useMemo(() => SUGGESTED_AIRPORT_IDS.map((id) => byId.get(id)).filter((a): a is Airport => !!a), [byId]);

  const finish = async (skip: boolean) => {
    setBusy(true);
    try {
      if (!skip) await seedSubjects([...picked, ...extra]);
      await ensureUsableSubject();
      await updatePreferences({
        onboardedAt: new Date().toISOString(),
        ...(skip ? {} : { homeAirportId: home?.id, displayName: name.trim() || undefined }),
      });
      router.replace(skip ? "/" : "/boarding/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存できませんでした", "error");
      setBusy(false);
    }
  };

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <main className="px-safe pt-safe pb-safe relative mx-auto flex min-h-dvh max-w-xl flex-col overflow-hidden">
      <div className="earth-arc" aria-hidden />
      <div className="relative flex items-center justify-between py-2">
        <ol className="flex gap-1.5" aria-label={`ステップ ${step + 1} / ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-sky" : "bg-elevated"}`} aria-current={i === step ? "step" : undefined}>
              <span className="sr-only">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => finish(true)} disabled={busy} className="min-h-11 rounded-xl px-3 text-sm text-mute hover:text-ink">
          スキップ
        </button>
      </div>

      <div className="relative flex flex-1 flex-col">
        {step === 0 && (
          <section className="animate-fade-up flex flex-1 flex-col justify-center gap-6 py-6">
            <BrandMark size={72} />
            <div>
              <h1 className="text-[32px] leading-tight font-bold tracking-tight">
                勉強時間を、
                <br />
                ひとつのフライトに。
              </h1>
              <p className="mt-4 text-[15px] text-mute">
                科目と行き先を選んで搭乗券を発行。集中している間、地球儀の上を飛行機が進みます。着陸すると学習時間・マイル（SkyPoints）・訪れた空港が記録されます。
              </p>
            </div>
            <ul className="flex flex-col gap-2 text-sm text-mute">
              <li>・ログイン不要。データはこの端末の中だけに保存されます</li>
              <li>・画面を閉じてもタイマーは時刻で正確に進みます</li>
              <li>・設定からいつでもバックアップできます</li>
            </ul>
          </section>
        )}

        {step === 1 && (
          <section className="animate-fade-up flex flex-col gap-5 py-6" aria-labelledby="ob-subjects">
            <div>
              <h1 id="ob-subjects" className="text-2xl font-bold">
                どの科目を勉強しますか？
              </h1>
              <p className="mt-1 text-sm text-mute">あとから自由に追加・変更・アーカイブできます。</p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="科目の候補">
              {[...SAMPLE_SUBJECTS, ...extra].map((s) => {
                const on = picked.includes(s) || extra.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (extra.includes(s) ? setExtra((e) => e.filter((x) => x !== s)) : toggle(s))}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold transition-colors ${on ? "border-sky bg-sky/15 text-sky" : "border-line text-mute"}`}
                  >
                    {on && <IconCheck size={16} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = custom.trim();
                if (v && !extra.includes(v) && !SAMPLE_SUBJECTS.includes(v)) setExtra((x) => [...x, v]);
                setCustom("");
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={40}
                placeholder="ほかの科目を追加（例: 解剖学）"
                aria-label="科目名"
                className="min-h-12 flex-1 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-sky"
              />
              <button type="submit" aria-label="科目を追加" className="inline-flex size-12 items-center justify-center rounded-2xl bg-elevated text-sky">
                <IconPlus />
              </button>
            </form>
            {picked.length + extra.length === 0 && <p className="text-xs text-mute">科目を選ばない場合は「自由学習」を用意します。</p>}
          </section>
        )}

        {step === 2 && (
          <section className="animate-fade-up flex flex-col gap-5 py-6" aria-labelledby="ob-home">
            <div>
              <h1 id="ob-home" className="text-2xl font-bold">
                ホーム空港を選びましょう
              </h1>
              <p className="mt-1 text-sm text-mute">最初のフライトの出発地になります（任意）。</p>
            </div>
            <AirportCombobox label="ホーム" value={home} onChange={setHome} airports={airports} recent={[]} suggested={suggested} />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">表示名（任意）</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="搭乗券に表示されます"
                className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-ink outline-none focus:border-sky"
              />
            </label>
          </section>
        )}
      </div>

      <div className="relative grid grid-cols-[auto_1fr] gap-3 pt-2">
        {step > 0 ? (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            戻る
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button size="lg" onClick={() => setStep((s) => s + 1)} className={step === 0 ? "col-span-2" : ""}>
            {step === 0 ? "はじめる" : "次へ"}
          </Button>
        ) : (
          <Button size="lg" disabled={busy} onClick={() => finish(false)}>
            最初のフライトを予約
          </Button>
        )}
      </div>
    </main>
  );
}
