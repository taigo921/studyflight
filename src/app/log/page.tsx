import type { Metadata } from "next";
import { Suspense } from "react";
import { LogScreen } from "@/components/screens/LogScreen";

export const metadata: Metadata = { title: "フライトログ" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LogScreen />
    </Suspense>
  );
}
