/**
 * StudyFlight オリジナルロゴ: 地球の弧（地平線）と、その上を進む点線の航路・機影。
 * 既存ブランドの意匠を参照せず制作。
 */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="StudyFlight">
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#182741" />
          <stop offset="1" stopColor="#07101F" />
        </linearGradient>
        <linearGradient id="bm-earth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#66B3FF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#66B3FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#bm-bg)" />
      <path d="M-4 58 C 14 40, 50 40, 68 58" fill="none" stroke="url(#bm-earth)" strokeWidth="2.5" />
      <path d="M12 46 C 22 30, 34 22, 48 18" fill="none" stroke="#EBC77B" strokeWidth="2" strokeDasharray="1 4.2" strokeLinecap="round" />
      <g transform="translate(47 17) rotate(-28)">
        <path d="M0 -6.5c.9 0 1.3.8 1.3 2v3.6l5.5 3.3v1.6L1.3 2.4v3l1.6 1.3v1.2L0 7.1l-2.9.8V6.7l1.6-1.3v-3L-6.8 4V2.4l5.5-3.3v-3.6c0-1.2.4-2 1.3-2Z" fill="#F6F8FF" transform="rotate(90)" />
      </g>
      <circle cx="12" cy="46" r="2.4" fill="#EBC77B" />
    </svg>
  );
}
