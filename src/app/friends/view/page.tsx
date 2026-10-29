import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendDetailScreen } from "@/components/social/FriendDetailScreen";

export const metadata: Metadata = { title: "フレンドの記録" };

export default function Page() {
  return (
    <Suspense>
      <FriendDetailScreen />
    </Suspense>
  );
}
