"use client";

// 地図の表示モード選択とフォールバック。地図が失敗してもタイマー・記録は影響を受けない。
import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { LngLat } from "@/domain/geo";
import type { FlightCamera, MapMode, MapStyleId } from "@/domain/types";
import { isWebGLAvailable } from "@/lib/world";
import { RouteMap2D } from "./RouteMap2D";

const FlightMapView = dynamic(() => import("./FlightMapView"), { ssr: false, loading: () => null });

const subscribeNothing = () => () => {};

export interface FlightMapProps {
  origin: LngLat;
  destination: LngLat;
  originCode: string;
  destinationCode: string;
  progress: number;
  getProgress: () => number;
  plannedSeconds: number;
  mapMode: MapMode;
  styleId: MapStyleId;
  labels: boolean;
  camera: FlightCamera;
  reducedMotion: boolean;
  onTileTrouble?: () => void;
}

export function FlightMap(props: FlightMapProps) {
  const webgl = useSyncExternalStore(subscribeNothing, isWebGLAvailable, () => false);
  const [failed, setFailed] = useState<string | null>(null);
  const onFail = useCallback((reason: string) => setFailed((prev) => prev ?? reason), []);
  const use3d = !failed && webgl && props.mapMode !== "2d";

  const flat = (
    <div className="absolute inset-0">
      <RouteMap2D origin={props.origin} destination={props.destination} originCode={props.originCode} destinationCode={props.destinationCode} progress={props.progress} />
    </div>
  );
  return (
    <div className="absolute inset-0 overflow-hidden" data-map-mode={use3d ? "3d" : "2d"} data-map-error={failed ?? undefined}>
      {use3d ? (
        <ErrorBoundary fallback={flat} onError={(e) => onFail(e.message)}>
          <FlightMapView {...props} onFail={onFail} />
        </ErrorBoundary>
      ) : (
        flat
      )}
      {failed && props.mapMode !== "2d" && <span className="sr-only">3D 地図を表示できなかったため 2D 航路図で表示しています</span>}
    </div>
  );
}
