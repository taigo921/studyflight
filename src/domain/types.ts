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
  distanceKm: number;
  earnedSkyPoints: number;
  note?: string;
  /** 端末時刻の巻き戻しなど異常を検知した場合の記録 */
  clockAnomaly?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
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

export interface Preferences {
  language: "ja";
  displayName?: string;
  homeAirportId?: string;
  soundMode: SoundMode;
  reducedMotion: boolean;
  mapMode: MapMode;
  backgroundBehavior: "continue";
  onboardedAt?: ISODate | null;
  /** 早期着陸を「完了」とみなす最小集中秒数 */
  earlyLandingMinSeconds: number;
}
