import { expect, test } from "@playwright/test";
import { skipOnboarding, startFlight, T0 } from "./helpers";

test("着陸後に FlightLog の共有画像を作り、サイズと表示項目を切り替えて保存できる", async ({ page }) => {
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);
  await startFlight(page, "HND", "OKA", 30);
  await page.clock.fastForward("30:30");
  await page.waitForURL("**/arrival/**");
  await page.getByRole("button", { name: "FlightLog を共有" }).click();
  const preview = page.getByTestId("share-preview");
  await expect(preview).toBeVisible();
  const size = async () => preview.evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`);
  await expect.poll(size).toBe("1080x1920");
  await page.getByRole("radio", { name: "X 16:9" }).click();
  await expect.poll(size).toBe("1200x675");
  await page.getByRole("radio", { name: "フィード 4:5" }).click();
  await expect.poll(size).toBe("1080x1350");
  // 科目を隠しても作り直せる
  await page.getByLabel("科目").uncheck();
  await expect(preview).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "画像を保存" }).click();
  expect((await download).suggestedFilename()).toMatch(/^studyflight-HND-OKA-.*\.png$/);
});

test("先行登録 LP: オンボーディングなしで開け、送信先が未設定なら受付停止と表示。英語に切り替えられる", async ({ page }) => {
  await page.goto("/lp/?utm_source=tiktok&utm_campaign=beta");
  await expect(page).toHaveURL(/\/lp\//); // オンボーディングに飛ばされない
  await expect(page.getByRole("heading", { level: 1 })).toContainText("集中した時間だけ");
  await expect(page.getByText("先行登録の受付は準備中です")).toBeVisible();
  await expect(page.getByRole("button", { name: "登録する" })).toBeDisabled();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sf-attribution") ?? "null"));
  expect(stored.first).toMatchObject({ utm_source: "tiktok", utm_campaign: "beta", landingPath: "/lp/" });
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("only while you focus");
  await expect(page).toHaveURL(/lang=en/);
  await page.getByRole("link", { name: "Privacy Policy" }).last().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
});

test("設定で言語を英語にするとナビゲーションが英語になる。利用状況データは送信先未設定と表示", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/settings/");
  await expect(page.getByText("現在、利用状況データの送信先は設定されていない")).toBeVisible();
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.getByRole("radio", { name: "日本語" }).click();
  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
});
