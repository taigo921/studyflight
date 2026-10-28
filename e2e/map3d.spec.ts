import { expect, test } from "@playwright/test";
import { skipOnboarding, startFlight, T0 } from "./helpers";

test("3D 地図で飛行し、カメラを切り替えても地図が落ちずタイマーが進む", async ({ page, context }) => {
  // 外部の衛星画像・地図サーバーには接続しない（オフライン相当でも 3D は描画できることを確認）
  await context.route(/gibs\.earthdata\.nasa\.gov|tiles\.maps\.eox\.at|tiles\.openfreemap\.org|elevation-tiles-prod/, (r) => r.abort());
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);
  // CI の CPU 描画で地形は重すぎるため、地形なしの「地球」スタイルで 3D 描画とカメラを検証する
  await page.goto("/settings/");
  await page.getByLabel("地図の見た目").selectOption("globe");
  await startFlight(page, "HIJ", "HND", 45);
  const map = page.locator("[data-map-mode]");
  await expect(map).toHaveAttribute("data-map-mode", "3d");
  // 787-9 の 3D モデルが読み込まれると、2D の機体は隠れる
  await expect(page.locator(".maplibregl-marker:has(#sfp-body)")).toHaveCSS("visibility", "hidden", { timeout: 30000 });
  for (const name of ["航路全体", "窓から見る", "機体を追う"]) {
    await page.getByRole("radio", { name }).click();
    await expect(page.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
    await page.waitForTimeout(800);
    await expect(map).toHaveAttribute("data-map-mode", "3d");
  }
  await expect(map).not.toHaveAttribute("data-map-error", /.+/);
  // 追尾中に地図をドラッグすると自由に動かせ、「機体に戻る」で追尾に戻る
  const box = (await map.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 80, { steps: 8 });
  await page.mouse.up();
  const back = page.getByRole("button", { name: "機体に戻る" });
  await expect(back).toBeVisible();
  await back.dispatchEvent("click"); // CPU 描画で rAF が詰まるため安定待ちをしない
  await expect(back).toBeHidden();
  // 3D 表示中もタイマーは保存時刻から進む（着陸までの流れは 2D の機能テストで検証。
  // CI は GPU がなく、着陸直前の高精細な地形描画が非常に重くなるため）
  await page.clock.fastForward("10:00");
  await expect(page.getByTestId("elapsed")).toHaveText(/^10:/);
});
