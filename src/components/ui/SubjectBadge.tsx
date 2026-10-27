export function SubjectBadge({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]"}`}
      style={{ borderColor: `${color}66`, background: `${color}1a`, color }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
