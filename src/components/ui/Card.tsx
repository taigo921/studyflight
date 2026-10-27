import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-3xl border border-line/70 bg-surface/90 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur ${className}`} {...rest} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold tracking-[0.08em] text-mute uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="text-mute">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-mute">{children}</div>}
    </div>
  );
}
