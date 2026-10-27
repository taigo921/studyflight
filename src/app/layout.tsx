import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: { default: "StudyFlight", template: "%s | StudyFlight" },
  description: "学習時間を仮想フライトに。科目を選んで搭乗し、集中して、着陸とともに記録する。",
  applicationName: "StudyFlight",
  manifest: withBase("/manifest.webmanifest"),
  appleWebApp: { capable: true, title: "StudyFlight", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: withBase("/icons/icon-192.png?v=2"), sizes: "192x192", type: "image/png" },
      { url: withBase("/icons/icon.svg"), type: "image/svg+xml" },
    ],
    apple: [{ url: withBase("/icons/apple-touch-icon.png?v=2"), sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07101F",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="starfield min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
