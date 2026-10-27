"use client";
import { PageHeader } from "@/components/ui/PageHeader";
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="px-safe mx-auto max-w-xl">
      <PageHeader title={title} />
      <p className="text-mute">準備中</p>
    </main>
  );
}
