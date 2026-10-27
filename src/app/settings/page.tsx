import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const metadata: Metadata = { title: "設定" };

export default function Page() {
  return <SettingsScreen />;
}
