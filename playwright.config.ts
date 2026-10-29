import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // 3D（CPU 描画）が他のテストの処理を遅らせないよう、1件ずつ実行する
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // 機能テスト。CI には GPU がなく 3D 地図のソフトウェア描画が重いため、WebGL を切って 2D 地図で検証する
      name: "iphone-chromium",
      testIgnore: /(map3d|social)\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        // 環境に同梱された Chromium で iPhone の画面サイズ・タッチを再現する
        browserName: "chromium",
        defaultBrowserType: "chromium",
        launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] },
      },
    },
    {
      // 3D 地図（WebGL）の表示・カメラ切り替えのスモークテスト
      name: "iphone-3d",
      testMatch: /map3d\.spec\.ts/,
      // GPU のない環境では SwiftShader（CPU）描画のため処理が詰まることがある。実機相当の安定性ではないので再試行を許す
      retries: 2,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
        launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
      },
    },
    {
      // フレンド・同乗フライト（Firebase エミュレータに接続したビルドで実行: npm run test:e2e:social）
      name: "social",
      testMatch: /social\.spec\.ts/,
      timeout: 120_000,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
        launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] },
      },
    },
  ],
  webServer: {
    command: `node scripts/serve.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
});
