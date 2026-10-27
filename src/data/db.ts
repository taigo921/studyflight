// IndexedDB (Dexie) スキーマ。永続データの唯一の真実源。
// スキーマ変更時は version を上げ、upgrade() でマイグレーションを書く。

import Dexie, { type Table } from "dexie";
import type { Airport, FlightLeg, FlightSession, FocusSegment, Goals, Preferences, StudyTask, Subject, Trip } from "@/domain/types";

export type GoalsRow = Goals & { id: "default"; updatedAt: string };
export type PreferencesRow = Preferences & { id: "default"; updatedAt: string };
export interface MetadataRow {
  key: string;
  value: unknown;
}

export const DB_NAME = "studyflight";
export const SCHEMA_VERSION = 2;

export class StudyFlightDB extends Dexie {
  subjects!: Table<Subject, string>;
  tasks!: Table<StudyTask, string>;
  airports!: Table<Airport, string>;
  sessions!: Table<FlightSession, string>;
  focusSegments!: Table<FocusSegment, string>;
  goals!: Table<GoalsRow, string>;
  preferences!: Table<PreferencesRow, string>;
  appMetadata!: Table<MetadataRow, string>;
  legs!: Table<FlightLeg, string>;
  trips!: Table<Trip, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      subjects: "id, archivedAt, createdAt",
      tasks: "id, subjectId, status, createdAt",
      airports: "id, iata, icao, countryCode",
      sessions: "id, status, subjectId, createdAt, completedAt",
      focusSegments: "id, sessionId, startedAt",
      goals: "id",
      preferences: "id",
      appMetadata: "key",
    });
    // v2: 区間（分割して飛ぶフライト）と旅行計画
    this.version(2).stores({
      legs: "id, status, tripId, createdAt",
      trips: "id, status, createdAt",
    });
  }
}

let instance: StudyFlightDB | null = null;

export function getDb(): StudyFlightDB {
  if (!instance) instance = new StudyFlightDB();
  return instance;
}

/** テスト用: 別名の DB に差し替える。 */
export function setDbForTesting(db: StudyFlightDB | null): void {
  instance = db;
}
