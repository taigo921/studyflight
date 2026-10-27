import type { Metadata } from "next";
import { Suspense } from "react";
import { FlightScreen } from "@/components/screens/FlightScreen";

export const metadata: Metadata = { title: "フライト中" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FlightScreen />
    </Suspense>
  );
}
