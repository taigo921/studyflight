import type { Metadata } from "next";
import { SubjectsScreen } from "@/components/screens/SubjectsScreen";

export const metadata: Metadata = { title: "科目とタスク" };

export default function Page() {
  return <SubjectsScreen />;
}
