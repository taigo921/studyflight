import type { Metadata } from "next";
import { BoardingScreen } from "@/components/screens/BoardingScreen";

export const metadata: Metadata = { title: "搭乗手続き" };

export default function Page() {
  return <BoardingScreen />;
}
