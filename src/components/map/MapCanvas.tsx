"use client";

// MapLibre 地図の土台。スタイル（衛星/標準/ダーク/地球）の切り替えと 3D 地形を管理し、
// スタイルを読み込むたびに onStyleLoaded を呼ぶ（呼び出し側が航路などを重ねる）。
// WebGL の失敗は onFail で通知し、呼び出し側は 2D 表示に切り替える（タイマーには影響しない）。

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MLMap } from "maplibre-gl";
import type { MapStyleId, RenderQuality } from "@/domain/types";
import { withBase } from "@/lib/base-path";
import { buildMapStyle, DEM_SOURCE_ID } from "@/lib/map-styles";
import { deviceHints, resolveRenderSettings } from "@/lib/render-quality";

export type MapLib = typeof import("maplibre-gl");

export interface MapCanvasProps {
  styleId: MapStyleId;
  labels: boolean;
  /** 3D 地形（対応スタイルのみ。省電力では無効） */
  terrain?: boolean;
  /** 描画品質（生成時の解像度・地形・キャッシュ量） */
  quality?: RenderQuality;
  center: [number, number];
  zoom: number;
  interactive?: boolean;
  ariaLabel: string;
  /** 地図インスタンスの生成時に一度だけ */
  onReady?: (map: MLMap, ml: MapLib) => void;
  /** スタイルを読み込むたび（初回・切り替え時） */
  onStyleLoaded?: (map: MLMap, ml: MapLib) => void;
  onFail?: (reason: string) => void;
  /** 衛星画像などのタイルが続けて取得できないとき */
  onTileTrouble?: () => void;
  className?: string;
}

function terrainAllowed(p: Pick<MapCanvasProps, "terrain" | "quality">): boolean {
  return !!p.terrain && resolveRenderSettings(p.quality ?? "auto", deviceHints()).terrain;
}

export default function MapCanvas(props: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<MapLib | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  // 生成（1回だけ）
  useEffect(() => {
    let disposed = false;
    let removeLost = () => {};
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (disposed || !container.current) return;
        ml.setWorkerUrl(withBase("/maplibre/maplibre-gl-worker.mjs"));
        const p = latest.current;
        const { style, terrain } = await buildMapStyle(p.styleId, { labels: p.labels });
        if (disposed || !container.current) return;
        const rs = resolveRenderSettings(p.quality ?? "auto", deviceHints());
        const map = new ml.Map({
          container: container.current,
          pixelRatio: rs.pixelRatio,
          canvasContextAttributes: { antialias: rs.antialias, powerPreference: rs.pixelRatio > 1 ? "default" : "low-power" },
          maxTileCacheSize: rs.maxTileCacheSize,
          style,
          center: p.center,
          zoom: p.zoom,
          interactive: p.interactive ?? true,
          // 出典は画面側の「ⓘ」から一覧で表示する（MAP_CREDITS）
          attributionControl: false,
          maxPitch: 85,
          fadeDuration: 0,
          localIdeographFontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif",
        });
        mapRef.current = map;
        mlRef.current = ml;
        map.touchZoomRotate.disableRotation();
        const canvas = map.getCanvas();
        canvas.setAttribute("aria-hidden", "true");
        const onLost = () => !disposed && latest.current.onFail?.("webgl context lost");
        canvas.addEventListener("webglcontextlost", onLost, { once: true });
        removeLost = () => canvas.removeEventListener("webglcontextlost", onLost);

        let tileErrors = 0;
        let ready = false;
        map.on("error", (e) => {
          const sourceId = (e as { sourceId?: string }).sourceId;
          if (sourceId) {
            if (sourceId === "sf-satellite" && ++tileErrors === 6) latest.current.onTileTrouble?.();
            return; // タイル単位の失敗は致命的ではない
          }
          if (!ready) latest.current.onFail?.(e.error?.message ?? "map error");
        });
        const applyTerrain = (enabled: boolean) => {
          try {
            if (enabled && map.getSource(DEM_SOURCE_ID)) map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.25 });
            else map.setTerrain(null as never);
          } catch {
            /* 地形非対応でも続行 */
          }
        };
        map.on("style.load", () => {
          ready = true;
          const cur = latest.current;
          applyTerrain(terrainAllowed(cur) && map.getStyle().sources?.[DEM_SOURCE_ID] !== undefined);
          cur.onStyleLoaded?.(map, ml);
        });
        void terrain;
        latest.current.onReady?.(map, ml);
      } catch (e) {
        latest.current.onFail?.(e instanceof Error ? e.message : "map init failed");
      }
    })();
    return () => {
      disposed = true;
      removeLost();
      try {
        const map = mapRef.current;
        // iOS Safari は WebGL コンテキストの解放が遅れるため、明示的に手放す
        const gl = map?.getCanvas().getContext("webgl2") ?? map?.getCanvas().getContext("webgl");
        map?.remove();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
  }, []);

  // スタイル切り替え
  const { styleId, labels } = props;
  const terrain = terrainAllowed(props);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    void buildMapStyle(styleId, { labels }).then(({ style }) => {
      if (!cancelled) mapRef.current?.setStyle(style, { diff: false });
    });
    return () => {
      cancelled = true;
    };
  }, [styleId, labels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (terrain && map.getSource(DEM_SOURCE_ID)) map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: 1.25 });
      else map.setTerrain(null as never);
    } catch {
      /* noop */
    }
  }, [terrain]);

  // MapLibre の CSS がコンテナを position:relative にするため、外側で絶対配置する
  return (
    <div className={`absolute inset-0 ${props.className ?? ""}`} role="img" aria-label={props.ariaLabel}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
