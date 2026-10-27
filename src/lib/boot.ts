// アプリ起動時の初期化。DB を開き、閉じている間に予定時刻を過ぎたフライトを着陸させる。
import { getDb } from "@/data/db";
import { resolveDueFlights } from "@/data/sessions";
import type { FlightSession } from "@/domain/types";

export async function bootstrap(): Promise<{ landed: FlightSession[] }> {
  const db = getDb();
  await db.open();
  // ブラウザによるデータ自動削除を避けるため永続化を要求（拒否されても続行）
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* noop */
  }
  const landed = await resolveDueFlights();
  return { landed };
}

export function normalizePath(pathname: string | null): string {
  if (!pathname) return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
