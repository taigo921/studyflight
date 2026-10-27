// 旅行計画（出発空港 → 最終目的地。複数の区間を経由する）。
import type { Trip } from "@/domain/types";
import { newId } from "@/lib/id";
import { getDb } from "./db";

export async function getActiveTrip(): Promise<Trip | undefined> {
  return getDb().trips.where("status").equals("active").first();
}

/** 最終目的地を設定する。進行中の旅行があれば目的地を変更、なければ新しく始める。null で目的地なし。 */
export async function setFinalDestination(originAirportId: string, finalDestinationId: string | null): Promise<Trip> {
  const db = getDb();
  return db.transaction("rw", db.trips, async () => {
    const t = new Date().toISOString();
    const active = await db.trips.where("status").equals("active").first();
    if (active) {
      const next = { ...active, finalDestinationId, updatedAt: t };
      await db.trips.put(next);
      return next;
    }
    const trip: Trip = { id: newId(), originAirportId, finalDestinationId, status: "active", createdAt: t, updatedAt: t, completedAt: null };
    await db.trips.add(trip);
    return trip;
  });
}

export async function abandonTrip(id: string): Promise<void> {
  await getDb().trips.update(id, { status: "abandoned", updatedAt: new Date().toISOString() });
}
