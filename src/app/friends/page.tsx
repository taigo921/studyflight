import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsScreen } from "@/components/social/FriendsScreen";

export const metadata: Metadata = { title: "フレンド" };

export default function Page() {
  return (
    <Suspense>
      <FriendsScreen />
    </Suspense>
  );
}
