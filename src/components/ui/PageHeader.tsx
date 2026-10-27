"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevronLeft } from "@/components/icons/Icons";

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: ReactNode; back?: string; action?: ReactNode }) {
  return (
    <header className="pt-safe mb-5 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <Link href={back} aria-label="戻る" className="-ml-3 inline-flex size-11 items-center justify-center rounded-full text-mute hover:text-ink">
            <IconChevronLeft />
          </Link>
        )}
        <div className="min-w-0">
          {subtitle && <p className="text-[13px] text-mute">{subtitle}</p>}
          <h1 className="truncate text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
        </div>
      </div>
      {action}
    </header>
  );
}
