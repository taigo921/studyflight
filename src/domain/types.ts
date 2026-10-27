// 永続データの型定義。PRODUCT_SPEC §5 に準拠。
// ID は UUID、タイムスタンプは ISO 8601 UTC 文字列。

export type UUID = string;
export type ISODate = string;

export type SessionStatus = "boarding" | "active" | "paused" | "completed" | "abandoned";
export type CompletionType = "on_time" | "early";

export interface Subject {
  id: UUID;
  name: string;
  color: string;
  icon?: string;
  archivedAt?: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface StudyTask {
  id: UUID;
  subjectId: UUID;
  title: string;
  status: "todo" | "done";
  estimatedMinutes?: number;
  createdAt: ISODate;
  completedAt?: ISODate | null;
  updatedAt: ISODate;
}

export type AirportType = "large_airport" | "medium_airport" | "small_airport";

export interface Airport {
  id: string;
  name: string;
  /** 日本語名（主要空港のみ） */
  nameJa?: string;
  municipality?: string;
  countryCode: string;
  iata?: string;
  icao?: string;
  lat: number;
  lng: number;
  type: AirportType;
  /** 検索用の補助キーワード（日本語表記など） */
  keywords?: string;
}

export interface FlightSession {
  id: UUID;
  status: SessionStatus;
  subjectId: UUID;
  /** 科目アーカイブ・削除後もラベルを残すためのスナップショット */
  subjectName: string;
  subjectColor: string;
  taskId?: UUID | null;
  taskTitle?: string | null;
  originAirportId: string;
  destinationAirportId: string;
  /** 表示用の空港コード（IATA優先）。空港データが欠けても表示できるよう保持 */
  originCode: string;
  destinationCode: string;
  seat: string;
  plannedSeconds: number;
  startedAt?: ISODate | null;
  /** active の時のみ。最後にタイマーを進め始めた時刻 */
  activeSince?: ISODate | null;
  /** 最後の停止までに確定した集中時間（秒、ミリ秒精度の小数） */
  accumulatedFocusSeconds: number;
  pausedAt?: ISODate | null;
  completedAt?: ISODate | null;
  /** 終了時に確定（整数秒）。plannedSeconds が上限 */
  actualFocusSeconds?: number | null;
  completionType?: CompletionType | null;
  abandonmentReason?: string | null;
  /** 旧仕様（ダイバート）で記録された着陸空港。新しい記録では使わない */
  landedAirportId?: string | null;
  landedCode?: string | null;
  /** このセッションで飛んだ区間（未設定は旧形式の記録） */
  legId?: string | null;
  /** セッション開始時点の区間の飛行済み秒数 */
  legStartSeconds?: number;
  /** 区間の推定予定飛行時間（秒） */
  legScheduledSeconds?: number;
  /** 区間の全距離（km）。distanceKm はこのセッションで実際に進んだ距離 */
  routeDistanceKm?: number;
  /** このセッションの終了時に区間の目的地へ到着したか（false = 上空で停止） */
  reachedDestination?: boolean;
  distanceKm: number;
  earnedSkyPoints: number;
  note?: string;
  /** 端末時刻の巻き戻しなど異常を検知した場合の記録 */
  clockAnomaly?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** 旅行計画（出発空港から最終目的地まで、複数区間を経由する） */
export interface Trip {
  id: UUID;
  originAirportId: string;
  finalDestinationId: string | null;
  status: "active" | "completed" | "abandoned";
  createdAt: ISODate;
  updatedAt: ISODate;
  completedAt?: ISODate | null;
}

/**
 * 区間（1本のフライト）。予定飛行時間が学習時間より長ければ、複数のセッションに分けて飛ぶ。
 * flownSeconds は学習で実際に進んだ秒数の合計（学習していない時間は加算しない）。
 */
export interface FlightLeg {
  id: UUID;
  tripId: UUID | null;
  originAirportId: string;
  destinationAirportId: string;
  originCode: string;
  destinationCode: string;
  /** route = 路線データ（OpenFlights）に直行便の就航実績あり / estimated = データなし・推定 */
  routeSource: "route" | "estimated";
  carriers: string[];
  distanceKm: number;
  /** 推定予定飛行時間（秒） */
  scheduledSeconds: number;
  flownSeconds: number;
  status: "in_progress" | "arrived" | "cancelled";
  createdAt: ISODate;
  updatedAt: ISODate;
  arrivedAt?: ISODate | null;
}

export interface FocusSegment {
  id: UUID;
  sessionId: UUID;
  startedAt: ISODate;
  /** 進行中は null */
  endedAt: ISODate | null;
  durationSeconds: number;
}

export interface Goals {
  dailyFocusMinutes: number;
  weeklyFocusMinutes: number;
  minimumStreakMinutes: number;
  timezone: string;
}

export type SoundMode = "off" | "cabin" | "rain" | "white_noise";
export type MapMode = "auto" | "3d" | "2d";
/** 地図の見た目 */
export type MapStyleId = "satellite" | "standard" | "dark" | "globe";
/** フライト中のカメラ */
export type FlightCamera = "follow" | "overview" | "window";
export type RenderQuality = "auto" | "low" | "high";

export interface Preferences {
  language: "ja" | "en";
  displayName?: string;
  homeAirportId?: string;
  soundMode: SoundMode;
  reducedMotion: boolean;
  mapMode: MapMode;
  mapStyle: MapStyleId;
  mapLabels: boolean;
  flightCamera: FlightCamera;
  /** 地図の描画品質 */
  renderQuality: RenderQuality;
  /** 行き先検索の許容幅（学習時間からの前後の分） */
  routeToleranceMinus: number;
  routeTolerancePlus: number;
  /** 路線データがある空港でも推定ルート（直行便データなし）を候補に含める */
  includeEstimatedRoutes: boolean;
  backgroundBehavior: "continue";
  onboardedAt?: ISODate | null;
  /** 早期着陸を「完了」とみなす最小集中秒数 */
  earlyLandingMinSeconds: number;
}
