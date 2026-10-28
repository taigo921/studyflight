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

/** 座席を選び、科目シートを閉じて行き先選びへ進む。 */
export async function chooseSeat(page: Page) {
  await page.locator('button[aria-label^="座席 "]:not([disabled])').first().click();
  await page.getByRole("button", { name: "この席で行き先を選ぶ" }).click();
}

/** 時間の目盛りをキーボードで合わせる（5分刻み）。 */
export async function setMinutes(page: Page, minutes: number) {
  const ruler = page.getByRole("slider", { name: "集中する時間" });
  await ruler.focus();
  const current = Number(await ruler.getAttribute("aria-valuenow"));
  const steps = Math.round((minutes - current) / 5);
  for (let i = 0; i < Math.abs(steps); i++) await ruler.press(steps > 0 ? "ArrowRight" : "ArrowLeft");
  await expect(ruler).toHaveAttribute("aria-valuenow", String(minutes));
}

async function openList(page: Page) {
  await page.getByRole("button", { name: "行き先をリストで選ぶ・出発地を変える" }).click();
}

/** 行き先を候補から選ぶ。候補に無ければリストの「リストにない空港へ飛ぶ」から選ぶ。 */
export async function pickDestination(page: Page, code: string) {
  const candidate = page.getByRole("radiogroup", { name: "行き先の候補" }).first().getByRole("radio", { name: new RegExp(`^${code}`) });
  if (await candidate.count()) {
    await candidate.first().click();
    return;
  }
  await openList(page);
  await pickAirport(page, "到着", code);
}

/** 行き先選びの画面（初回の出発地選び / 地上 / 上空で一時停止中）が表示されるまで待つ。 */
export async function waitRouteStep(page: Page): Promise<"origin" | "ground"> {
  const origin = page.getByRole("button", { name: /^出発空港を選択$/ });
  const ground = page.getByRole("slider", { name: "集中する時間" });
  await expect(origin.or(ground).first()).toBeVisible();
  return (await origin.count()) ? "origin" : "ground";
}

/** 出発地を変える（現在地と異なる空港から飛ぶとき）。 */
export async function changeOrigin(page: Page, code: string) {
  await waitRouteStep(page);
  const direct = page.getByRole("button", { name: /^出発空港を選択$/ });
  if (await direct.count()) {
    await pickAirport(page, "出発", code);
    return;
  }
  const current = page.getByText("現在地").locator("..");
  if ((await current.textContent())?.includes(code)) return;
  await openList(page);
  await pickAirport(page, "出発", code);
  await page.keyboard.press("Escape");
}

/** 搭乗券を発行 → チェックイン → 搭乗 → 出発し、フライトの id を返す。from=null なら現在地から。 */
export async function startFlight(page: Page, from: string | null = "NKM", to = "HND", minutes = 25): Promise<string> {
  await page.goto("/boarding/");
  await chooseSeat(page);
  if (from) await changeOrigin(page, from);
  else if ((await waitRouteStep(page)) === "origin") throw new Error("出発地が未設定です");
  await setMinutes(page, minutes);
  await pickDestination(page, to);
  await page.getByRole("button", { name: /行きの搭乗券を発行/ }).click();
  return boardAndDepart(page);
}

async function boardAndDepart(page: Page): Promise<string> {
  await page.getByRole("button", { name: "チェックイン" }).click();
  await page.getByRole("button", { name: "搭乗する" }).click();
  await page.getByRole("button", { name: "出発する" }).click();
  await page.waitForURL("**/flight/?id=*");
  await expect(page.getByTestId("flight-screen")).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}
