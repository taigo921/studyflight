import type { Metadata } from "next";
import { PassportScreen } from "@/components/screens/PassportScreen";

export const metadata: Metadata = { title: "パスポート" };

export default function Page() {
  return <PassportScreen />;
}
