// public/icons/icon.svg から PWA 用 PNG アイコンを生成する（Playwright の Chromium を使用）。
// 使い方: node scripts/generate-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const svg = readFileSync(join("public", "icons", "icon.svg"), "utf8");
// iOS のホーム画面アイコンは自動で角丸になるため、正方形・全面塗りの版も用意する
const square = svg.replace('rx="15"', 'rx="0"');
const targets = [
  { file: "icon-192.png", size: 192, svg },
  { file: "icon-512.png", size: 512, svg },
  { file: "icon-maskable-512.png", size: 512, svg: square, pad: 0.12 },
  { file: "apple-touch-icon.png", size: 180, svg: square },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * (t.pad ?? 0)));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#07101F;display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${t.svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: join("public", "icons", t.file), omitBackground: !t.pad && t.svg === svg });
  console.log(`[icons] ${t.file}`);
}
await browser.close();
