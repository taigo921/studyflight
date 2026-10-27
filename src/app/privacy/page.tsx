import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/public/PrivacyScreen";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function Page() {
  return <PrivacyScreen />;
}
