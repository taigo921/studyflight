// フレンド・記録の閲覧・同乗フライト。Firebase エミュレータに接続したビルドで実行する: npm run test:e2e:social
import { devices, expect, test, type Page } from "@playwright/test";
import { changeOrigin, chooseSeat, pickDestination, setMinutes, skipOnboarding, startFlight } from "./helpers";

async function startSocial(page: Page, name: string) {
  await page.getByLabel("表示名（フレンドに見える名前）").fill(name);
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByTestId("my-friend-code")).toHaveText(/^[A-Z2-9]{8}$/);
}

test("友達を追加し、記録を見て、同じ便に乗って一緒に出発する", async ({ page: a, browser }) => {
  const ctxB = await browser.newContext({ ...devices["iPhone 13"], baseURL: "http://127.0.0.1:4173" });
  const b = await ctxB.newPage();
  await b.clock.install({ time: new Date() });

  // A: フレンド機能をはじめる
  await skipOnboarding(a);
  await a.goto("/friends/");
  await startSocial(a, "あきら");
  const code = (await a.getByTestId("my-friend-code").textContent())!;

  // B: A の招待リンクから開くと、名前を決めたあと自動で申請が届く
  await b.goto(`/friends/?add=${code}`);
  await startSocial(b, "ぼぶ");
  await expect(b.getByText("フレンド申請を送りました")).toBeVisible();

  // A: 申請を承認
  await a.getByRole("button", { name: "承認" }).click();
  await expect(a.getByRole("link", { name: /ぼぶ/ })).toBeVisible();

  // B: 25分勉強すると、A から B の記録が見える
  await skipOnboarding(b);
  await startFlight(b, "NKM", "HND", 25);
  await b.clock.fastForward("25:30");
  await b.waitForURL("**/arrival/**");
  await b.getByRole("button", { name: "保存して閉じる" }).click();
  await b.clock.runFor(5000); // 公開の送信待ち（数秒まとめて送る）
  await a.getByRole("link", { name: /ぼぶ/ }).click();
  await expect(a.getByTestId("friend-today")).toHaveText("25分", { timeout: 20000 });
  await expect(a.getByText("NKM → HND")).toBeVisible();

  // A: 同乗フライトを作って B を招待する
  await a.goto("/boarding/");
  await chooseSeat(a);
  await changeOrigin(a, "NGO");
  await setMinutes(a, 60);
  await pickDestination(a, "HND");
  await a.getByRole("button", { name: "友達と一緒に乗る" }).click();
  await a.getByRole("checkbox", { name: "ぼぶ" }).check();
  await a.getByRole("button", { name: "1人を招待して同乗便を作る" }).click();
  await expect(a.getByTestId("group-crew").first()).toContainText("同乗 1人");

  // B: 招待から座席を選んで乗る（A の席は友達の席として埋まっている）
  await b.goto("/friends/");
  await b.getByRole("link", { name: /NGO → HND/ }).click();
  await expect(b.getByText("あきら さんの便（機長）")).toBeVisible();
  await b.locator('button[aria-label^="座席 "]:not([disabled])').first().click();
  await b.getByRole("button", { name: /でこの便に乗る/ }).click();
  await b.waitForURL("**/boarding/");
  await expect(b.getByTestId("group-crew").first()).toContainText("同乗 2人");
  await expect(a.getByTestId("group-crew").first()).toContainText("同乗 2人");
  await b.getByRole("button", { name: "チェックイン" }).click();
  await b.getByRole("button", { name: "搭乗する" }).click();
  await expect(b.getByText(/機長（あきら）の出発を待っています/)).toBeVisible();

  // A（機長）が出発すると、B も自動で出発する
  await a.getByRole("button", { name: "チェックイン" }).click();
  await a.getByRole("button", { name: "搭乗する" }).click();
  await a.getByRole("button", { name: "全員で出発する" }).click();
  await a.waitForURL("**/flight/?id=*");
  await b.waitForURL("**/flight/?id=*", { timeout: 20000 });
  await expect(b.getByTestId("flight-screen")).toHaveAttribute("data-status", "active");

  // フライト中はお互いの様子が見える
  await expect(a.getByTestId("crew-strip")).toContainText("ぼぶ");
  await expect(a.getByTestId("crew-strip")).toContainText("集中中", { timeout: 20000 });
  await expect(b.getByTestId("crew-strip")).toContainText("あきら");

  await ctxB.close();
});
