// 地図の描画品質。低品質ほど GPU・バッテリー・通信量を抑える（タイマーには影響しない）。
import type { RenderQuality } from "@/domain/types";

export interface RenderSettings {
  /** キャンバスの解像度倍率 */
  pixelRatio: number;
  /** 3D 地形を使うか */
  terrain: boolean;
  /** フライト中にカメラを更新する間隔（ミリ秒） */
  frameIntervalMs: number;
  antialias: boolean;
  /** 保持するタイル数の上限 */
  maxTileCacheSize: number;
}

export interface DeviceHints {
  devicePixelRatio: number;
  /** GB（navigator.deviceMemory。Safari では未提供） */
  deviceMemory?: number;
  saveData?: boolean;
}

export const RENDER_QUALITY_LABELS: Record<RenderQuality, string> = {
  auto: "自動",
  low: "省電力",
  high: "高画質",
};

export function resolveRenderSettings(quality: RenderQuality, hints: DeviceHints): RenderSettings {
  const dpr = Math.max(1, hints.devicePixelRatio || 1);
  const constrained = !!hints.saveData || (hints.deviceMemory !== undefined && hints.deviceMemory < 4);
  const effective = quality === "auto" ? (constrained ? "low" : "auto") : quality;
  if (effective === "low") return { pixelRatio: 1, terrain: false, frameIntervalMs: 1000, antialias: false, maxTileCacheSize: 60 };
  if (effective === "high") return { pixelRatio: Math.min(dpr, 3), terrain: true, frameIntervalMs: 250, antialias: true, maxTileCacheSize: 300 };
  return { pixelRatio: Math.min(dpr, 2), terrain: true, frameIntervalMs: 500, antialias: false, maxTileCacheSize: 150 };
}

export function deviceHints(): DeviceHints {
  if (typeof window === "undefined") return { devicePixelRatio: 1 };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { devicePixelRatio: window.devicePixelRatio, deviceMemory: nav.deviceMemory, saveData: nav.connection?.saveData };
}
