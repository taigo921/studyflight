"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChart, IconHome, IconLog, IconPassport, IconPlane } from "@/components/icons/Icons";
import { useOpenFlight } from "@/features/data-hooks";
import { normalizePath } from "@/lib/boot";

export function BottomNav() {
  const path = normalizePath(usePathname());
  const open = useOpenFlight();
  const flightHref = open ? `/flight/?id=${open.id}` : "/boarding/";
  const items = [
    { href: "/", label: "ホーム", icon: IconHome, match: (p: string) => p === "/" || p === "/goals" || p === "/settings" || p === "/subjects" },
    { href: flightHref, label: "フライト", icon: IconPlane, match: (p: string) => p === "/boarding" },
    { href: "/log/", label: "ログ", icon: IconLog, match: (p: string) => p === "/log" },
    { href: "/analytics/", label: "分析", icon: IconChart, match: (p: string) => p === "/analytics" },
    { href: "/passport/", label: "パスポート", icon: IconPassport, match: (p: string) => p === "/passport" },
  ];
  return (
    <nav aria-label="メインナビゲーション" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-night/85 backdrop-blur-xl" style={{ paddingBottom: "var(--safe-bottom)" }}>
      <ul className="mx-auto grid h-[var(--nav-height)] max-w-xl grid-cols-5">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          const isFlight = label === "フライト";
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${active ? "text-ink" : "text-mute hover:text-ink"}`}
              >
                <span className={`relative inline-flex size-8 items-center justify-center rounded-full ${isFlight ? "bg-sky/15 text-sky" : ""}`}>
                  <Icon size={22} />
                  {isFlight && open && <span className="animate-pulse-soft absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-gold ring-2 ring-night" aria-label="フライト中" />}
                </span>
                {label}
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sky" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
