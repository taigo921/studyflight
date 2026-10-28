// 地図の描画品質。低品質ほど GPU・バッテリー・通信量を抑える（タイマーには影響しない）。
import type { RenderQuality } from "@/domain/types";

export interface RenderSettings {
  /** キャンバスの解像度倍率 */
  pixelRatio: number;
  /** 3D 地形を使うか */
  terrain: boolean;
  /** フライト中にカメラを更新する間隔（ミリ秒）。0 = 毎フレーム、33 ≒ 30fps */
  frameIntervalMs: number;
  antialias: boolean;
  /** 3D の機体モデル（Three.js）を使うか。省電力では 2D の機体 */
  model3d: boolean;
  /** 保持するタイル数の上限（null = MapLibre の自動設定） */
  maxTileCacheSize: number | null;
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
  if (effective === "low") return { pixelRatio: 1, terrain: false, frameIntervalMs: 250, antialias: false, model3d: false, maxTileCacheSize: 60 };
  if (effective === "high") return { pixelRatio: Math.min(dpr, 3), terrain: true, frameIntervalMs: 0, antialias: true, model3d: true, maxTileCacheSize: null };
  return { pixelRatio: Math.min(dpr, 2), terrain: true, frameIntervalMs: 33, antialias: false, model3d: true, maxTileCacheSize: null };
}

export function deviceHints(): DeviceHints {
  if (typeof window === "undefined") return { devicePixelRatio: 1 };
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { devicePixelRatio: window.devicePixelRatio, deviceMemory: nav.deviceMemory, saveData: nav.connection?.saveData };
}
