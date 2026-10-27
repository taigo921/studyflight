import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrivalScreen } from "@/components/screens/ArrivalScreen";

export const metadata: Metadata = { title: "到着" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ArrivalScreen />
    </Suspense>
  );
}
