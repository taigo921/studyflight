import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "iphone-chromium",
      use: {
        ...devices["iPhone 13"],
        // 環境に同梱された Chromium で iPhone の画面サイズ・タッチを再現する
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
  ],
  webServer: {
    command: `node scripts/serve.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
});
