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

/** 行き先を候補リストから選ぶ。候補に無ければ「リストにない空港へ飛ぶ」から選ぶ。 */
export async function pickDestination(page: Page, code: string) {
  const candidate = page.getByRole("radiogroup", { name: "行き先の候補" }).getByRole("radio", { name: new RegExp(`^${code}`) });
  if (await candidate.count()) {
    await candidate.first().click();
    return;
  }
  await page.getByText("リストにない空港へ飛ぶ・出発地を変える").click();
  await pickAirport(page, "到着", code);
}

/**
 * 搭乗券を発行して出発し、フライトの id を返す。
 * from を指定すると現在地に関係なくその空港から出発する（未指定なら現在地から）。
 */
export async function startFlight(page: Page, from: string | null = "NKM", to = "HND", minutes = 25): Promise<string> {
  await page.goto("/boarding/");
  if ([45, 60, 90].includes(minutes)) await page.getByRole("radio", { name: `${minutes}分` }).click();
  else if (minutes !== 25) await page.getByLabel("カスタム時間（分）").fill(String(minutes));
  if (from) {
    const direct = page.getByRole("button", { name: /^出発空港を選択$/ });
    if (await direct.count()) await pickAirport(page, "出発", from);
    else {
      await page.getByText("リストにない空港へ飛ぶ・出発地を変える").click();
      await pickAirport(page, "出発", from);
    }
  }
  await pickDestination(page, to);
  await page.getByRole("button", { name: "搭乗券を発行" }).click();
  await page.getByRole("button", { name: "出発する" }).click();
  await page.waitForURL("**/flight/?id=*");
  await expect(page.getByTestId("flight-screen")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}
