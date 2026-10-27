import type { Metadata } from "next";
import { LandingScreen } from "@/components/public/LandingScreen";

export const metadata: Metadata = {
  title: { absolute: "StudyFlight — 学習を、旅に。" },
  description: "集中した時間だけ飛行機が進む学習記録アプリ。実在の路線と衛星写真の上を飛びながら勉強できます。ベータ版の先行登録受付中。",
  openGraph: {
    title: "StudyFlight — 学習を、旅に。",
    description: "集中した時間だけ飛行機が進む学習記録アプリ。ベータ版の先行登録受付中。",
    type: "website",
  },
};

export default function Page() {
  return <LandingScreen />;
}
