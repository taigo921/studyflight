import type { NextConfig } from "next";

// 静的エクスポート: サーバー不要で、Service Worker により完全オフラインで動作させる。
// 動的ルートは使わず、/flight/?id=... のようにクエリでセッションを指定する。
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
