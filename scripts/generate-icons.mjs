// assets/app-icon.png（正方形・全面の元画像）から PWA 用 PNG アイコンを生成する（Playwright の Chromium を使用）。
// 使い方: node scripts/generate-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = `data:image/png;base64,${readFileSync(join("assets", "app-icon.png")).toString("base64")}`;
// iOS のホーム画面・Android のマスク可能アイコンは端末側で角丸にするため全面の正方形。
// purpose "any" の版は自前で角丸にして背景を透過する
const targets = [
  { file: "icon-192.png", size: 192, radius: 0.22 },
  { file: "icon-512.png", size: 512, radius: 0.22 },
  { file: "icon-maskable-512.png", size: 512, radius: 0 },
  { file: "apple-touch-icon.png", size: 180, radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${src}" style="display:block;width:${t.size}px;height:${t.size}px;border-radius:${t.size * t.radius}px"></body></html>`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  await page.screenshot({ path: join("public", "icons", t.file), omitBackground: t.radius > 0 });
  console.log(`[icons] ${t.file}`);
}
await browser.close();
