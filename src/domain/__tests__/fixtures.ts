import type { FlightSession } from "../types";

export const T0 = Date.parse("2026-10-27T01:00:00.000Z"); // JST 10:00

export function makeSession(overrides: Partial<FlightSession> = {}): FlightSession {
  const now = new Date(T0).toISOString();
  return {
    id: "s1",
    status: "boarding",
    subjectId: "sub1",
    subjectName: "生理学",
    subjectColor: "#66B3FF",
    taskId: null,
    originAirportId: "RJNA",
    destinationAirportId: "RJTT",
    originCode: "NKM",
    destinationCode: "HND",
    seat: "12A",
    plannedSeconds: 25 * 60,
    accumulatedFocusSeconds: 0,
    distanceKm: 280,
    earnedSkyPoints: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export const min = (m: number) => m * 60_000;
