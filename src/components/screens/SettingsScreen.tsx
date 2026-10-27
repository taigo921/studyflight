"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AirportCombobox } from "@/components/flight/AirportCombobox";
import { IconChevronRight, IconTarget } from "@/components/icons/Icons";
import { DataSection } from "@/components/settings/DataSection";
import { InstallGuide } from "@/components/settings/InstallGuide";
import { Card, SectionTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { SUGGESTED_AIRPORT_IDS } from "@/data/core-airports";
import { updateGoals, updatePreferences } from "@/data/settings";
import type { Airport, MapMode, MapStyleId } from "@/domain/types";
import { MAP_STYLE_LABELS } from "@/lib/map-styles";
import { deviceTimeZone } from "@/domain/zoned";
import { useGoals, usePreferences } from "@/features/data-hooks";
import { useAirports } from "@/features/useAirports";

const COMMON_ZONES = ["Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney", "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Honolulu", "UTC"];

function allZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? COMMON_ZONES;
  } catch {
    return COMMON_ZONES;
  }
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4">
      <span>
        <span className="block text-[15px]">{label}</span>
        {description && <span className="block text-xs text-mute">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-8 w-[52px] rounded-full bg-elevated transition-colors peer-checked:bg-sky peer-focus-visible:outline-2 peer-focus-visible:outline-sky" aria-hidden />
        <span className="absolute top-1 left-1 size-6 rounded-full bg-ink shadow transition-transform peer-checked:translate-x-5" aria-hidden />
      </span>
    </label>
  );
}

export function SettingsScreen() {
  const prefs = usePreferences();
  const goals = useGoals();
  const { airports, byId } = useAirports();
  const [name, setName] = useState<string | null>(null);
  const suggested = useMemo(() => SUGGESTED_AIRPORT_IDS.map((id) => byId.get(id)).filter((a): a is Airport => !!a), [byId]);
  const zones = useMemo(() => {
    const z = allZones();
    return z.includes(goals.timezone) ? z : [goals.timezone, ...z];
  }, [goals.timezone]);
  const home = prefs.homeAirportId ? (byId.get(prefs.homeAirportId) ?? null) : null;
  const device = deviceTimeZone();

  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title="設定" back="/" />
      <div className="flex flex-col gap-5">
        <nav className="flex flex-col gap-2" aria-label="設定メニュー">
          {[
            { href: "/subjects/", label: "科目とタスク", icon: null },
            { href: "/goals/", label: "学習目標", icon: <IconTarget size={20} className="text-sky" /> },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-14 items-center justify-between rounded-2xl border border-line/70 bg-surface/80 px-4 font-semibold hover:bg-elevated">
              <span className="flex items-center gap-2">
                {l.icon}
                {l.label}
              </span>
              <IconChevronRight className="text-mute" />
            </Link>
          ))}
        </nav>

        <Card className="flex flex-col gap-4">
          <SectionTitle>プロフィール</SectionTitle>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">表示名</span>
            <input
              value={name ?? prefs.displayName ?? ""}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== null && updatePreferences({ displayName: name.trim() || undefined })}
              maxLength={20}
              placeholder="搭乗券に表示されます"
              className="min-h-12 rounded-2xl border border-line bg-night px-4 text-ink outline-none focus:border-sky"
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">ホーム空港</span>
            <AirportCombobox label="ホーム" value={home} onChange={(a) => updatePreferences({ homeAirportId: a.id })} airports={airports} recent={[]} suggested={suggested} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionTitle>時間と集計</SectionTitle>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">タイムゾーン</span>
            <select value={goals.timezone} onChange={(e) => updateGoals({ timezone: e.target.value })} className="min-h-12 rounded-2xl border border-line bg-night px-3 text-ink">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                  {z === device ? "（この端末）" : ""}
                </option>
              ))}
            </select>
            <span className="text-xs text-mute">日・週の区切りに使います。変更すると過去の統計もこの設定で再計算されます。</span>
          </label>
          <Stepper
            label="早期着陸を完了とみなす最短時間"
            value={Math.round(prefs.earlyLandingMinSeconds / 60)}
            min={1}
            max={60}
            step={1}
            unit="分"
            onChange={(v) => updatePreferences({ earlyLandingMinSeconds: v * 60 })}
          />
          <p className="-mt-2 text-xs text-mute">これより短く着陸したフライトは欠航扱い（学習時間・ポイントの対象外）になります。</p>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionTitle>表示</SectionTitle>
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">フライト中の地図</span>
            <Segmented<MapMode>
              label="地図の表示"
              value={prefs.mapMode}
              onChange={(v) => updatePreferences({ mapMode: v })}
              options={[
                { value: "auto", label: "自動" },
                { value: "3d", label: "3D 地球儀" },
                { value: "2d", label: "2D・省電力" },
              ]}
            />
            <span className="text-xs text-mute">3D が使えない端末では自動で 2D の航路図に切り替わります。</span>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">地図の見た目</span>
            <select value={prefs.mapStyle} onChange={(e) => updatePreferences({ mapStyle: e.target.value as MapStyleId })} className="min-h-12 rounded-2xl border border-line bg-night px-3 text-ink">
              {(Object.keys(MAP_STYLE_LABELS) as MapStyleId[]).map((id) => (
                <option key={id} value={id}>
                  {MAP_STYLE_LABELS[id]}
                </option>
              ))}
            </select>
            <span className="text-xs text-mute">フライト中も右上のボタンから切り替えられます。衛星写真は Sentinel-2（約10m解像度）の雲なし合成画像です。</span>
          </label>
          <Toggle label="地名ラベル" checked={prefs.mapLabels} onChange={(v) => updatePreferences({ mapLabels: v })} />
          <Toggle label="動きを減らす" description="着陸演出やカメラの移動を最小限にします" checked={prefs.reducedMotion} onChange={(v) => updatePreferences({ reducedMotion: v })} />
        </Card>

        <Card>
          <SectionTitle>バックアップ</SectionTitle>
          <DataSection />
        </Card>

        <Card>
          <SectionTitle>ホーム画面に追加</SectionTitle>
          <InstallGuide />
        </Card>

        <Card className="flex flex-col gap-2 text-xs text-mute">
          <SectionTitle>このアプリについて</SectionTitle>
          <p>StudyFlight は学習時間を仮想フライトとして記録するアプリです。航路・機体・飛行時間は演出であり、実在の航空便とは関係ありません。</p>
          <p>タイマーは保存した時刻から計算するため、画面を閉じても進みます。実際に学習していたかどうかは計測しません。また、他のアプリの使用を制限する機能はありません。</p>
          <p>
            空港データ: OurAirports（パブリックドメイン） / 衛星画像: Sentinel-2 cloudless by EOX IT Services GmbH（Contains modified Copernicus Sentinel data） / 標高: Terrain Tiles（Mapzen, AWS
            Open Data） / 地図・地名: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors / 地図データ: Natural Earth（パブリックドメイン） / 地図描画: MapLibre GL JS（BSD-3-Clause）
          </p>
          <p>サウンドは端末内で合成しています。ロゴ・アイコンは本アプリのオリジナルです。</p>
        </Card>
      </div>
    </main>
  );
}
