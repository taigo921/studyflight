import { DEFAULT_EARLY_LANDING_MIN_SECONDS } from "@/domain/session";
import type { Goals, Preferences } from "@/domain/types";
import { deviceTimeZone } from "@/domain/zoned";
import { getDb, type GoalsRow, type PreferencesRow } from "./db";

export function defaultGoals(): GoalsRow {
  return {
    id: "default",
    dailyFocusMinutes: 60,
    weeklyFocusMinutes: 300,
    minimumStreakMinutes: 10,
    timezone: deviceTimeZone(),
    updatedAt: new Date().toISOString(),
  };
}

export function defaultPreferences(): PreferencesRow {
  return {
    id: "default",
    language: "ja",
    soundMode: "off",
    reducedMotion: false,
    mapMode: "auto",
    backgroundBehavior: "continue",
    onboardedAt: null,
    earlyLandingMinSeconds: DEFAULT_EARLY_LANDING_MIN_SECONDS,
    updatedAt: new Date().toISOString(),
  };
}

export async function getGoals(): Promise<GoalsRow> {
  return { ...defaultGoals(), ...((await getDb().goals.get("default")) ?? {}) };
}

export async function updateGoals(patch: Partial<Goals>): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.goals, async () => {
    const cur = await getGoals();
    await db.goals.put({ ...cur, ...patch, id: "default", updatedAt: new Date().toISOString() });
  });
}

export async function getPreferences(): Promise<PreferencesRow> {
  return { ...defaultPreferences(), ...((await getDb().preferences.get("default")) ?? {}) };
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.preferences, async () => {
    const cur = await getPreferences();
    await db.preferences.put({ ...cur, ...patch, id: "default", updatedAt: new Date().toISOString() });
  });
}
