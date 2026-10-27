import type { Metadata } from "next";
import { OnboardingScreen } from "@/components/screens/OnboardingScreen";

export const metadata: Metadata = { title: "はじめに" };

export default function Page() {
  return <OnboardingScreen />;
}
