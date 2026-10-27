import type { NextConfig } from "next";

// 静的エクスポート: サーバー不要で、Service Worker により完全オフラインで動作させる。
// 動的ルートは使わず、/flight/?id=... のようにクエリでセッションを指定する。
const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages などサブパスで配信する場合はビルド時に NEXT_PUBLIC_BASE_PATH=/studyflight を指定する
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
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
