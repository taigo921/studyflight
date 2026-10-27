import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";

export const metadata: Metadata = { title: "分析" };

export default function Page() {
  return <AnalyticsScreen />;
}
