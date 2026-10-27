import { expect, type Page } from "@playwright/test";

export const T0 = new Date("2026-10-27T01:00:00Z"); // JST 10:00

export async function skipOnboarding(page: Page) {
  await page.goto("/");
  await page.waitForURL("**/onboarding/");
  await page.getByRole("button", { name: "スキップ" }).click();
  await page.waitForURL((u) => u.pathname === "/");
}

export async function pickAirport(page: Page, which: "出発" | "到着", query: string) {
  await page.getByRole("button", { name: new RegExp(`^${which}空港を選択`) }).click();
  await page.getByPlaceholder("HND、成田、London など").fill(query);
  await page.getByRole("option").first().click();
}

/** 搭乗券を発行して出発し、フライト画面の id を返す。 */
export async function startFlight(page: Page, from = "NKM", to = "HND", minutes = 25): Promise<string> {
  await page.goto("/boarding/");
  await pickAirport(page, "出発", from);
  await pickAirport(page, "到着", to);
  if (minutes !== 25) await page.getByRole("radio", { name: `${minutes}分` }).click();
  await page.getByRole("button", { name: "搭乗券を発行" }).click();
  await page.getByRole("button", { name: "出発する" }).click();
  await page.waitForURL("**/flight/?id=*");
  await expect(page.getByTestId("flight-screen")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}
