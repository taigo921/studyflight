import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupJoinScreen } from "@/components/social/GroupJoinScreen";

export const metadata: Metadata = { title: "同乗フライト" };

export default function Page() {
  return (
    <Suspense>
      <GroupJoinScreen />
    </Suspense>
  );
}
