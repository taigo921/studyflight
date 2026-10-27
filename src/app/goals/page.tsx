import type { Metadata } from "next";
import { GoalsScreen } from "@/components/screens/GoalsScreen";

export const metadata: Metadata = { title: "目標" };

export default function Page() {
  return <GoalsScreen />;
}
