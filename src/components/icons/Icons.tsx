// StudyFlight オリジナルのラインアイコン（24px グリッド、1.75 ストローク）。
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6.5 10v9h11v-9" />
    <path d="M10 19v-4.5h4V19" />
  </Base>
);

/** 機体（真上から見た抽象形）。実在機材を模さない */
export const IconPlane = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3c.9 0 1.4.9 1.4 2.2v4.3l6.6 3.9v1.9l-6.6-2v3.6l2 1.6V20l-3.4-1-3.4 1v-1.5l2-1.6v-3.6l-6.6 2v-1.9l6.6-3.9V5.2C10.6 3.9 11.1 3 12 3Z" />
  </Base>
);

export const IconLog = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Base>
);

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6.5" rx="1" />
    <rect x="10.5" y="6.5" width="3" height="11" rx="1" />
    <rect x="15.5" y="13.5" width="3" height="4" rx="1" />
  </Base>
);

export const IconPassport = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <circle cx="12" cy="10.5" r="3.3" />
    <path d="M8.7 10.5h6.6M12 7.2c1 .9 1.4 2 1.4 3.3s-.4 2.4-1.4 3.3c-1-.9-1.4-2-1.4-3.3s.4-2.4 1.4-3.3Z" />
    <path d="M9 17.2h6" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.6v-1.9L4.2 8.9l1.7-2.9 2.3.8 1.6-.9.5-2.4Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
);

export const IconPause = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6v12M15 6v12" strokeWidth={2.4} />
  </Base>
);

export const IconPlay = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />
  </Base>
);

export const IconSound = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.5 7.5 0 0 1 0 10.4" />
  </Base>
);

export const IconMute = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 9.5h3l4-3.5v12l-4-3.5h-3z" />
    <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
  </Base>
);

export const IconLanding = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 20h18" />
    <path d="M4.5 9.5 7 10l2.4 3.4 9.3 2.4c.9.2 1.3-.9.5-1.4L11 10.6 8.6 5.3 6.8 4.9l1 5.1-2.3-.5Z" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.3-4.3" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 7h15M10 4h4M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6" />
  </Base>
);

export const IconEdit = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
    <path d="m14 8 2.5 2.5" />
  </Base>
);

export const IconTarget = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Base>
);

export const IconStreak = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5c.6 3-2.5 4.6-2.5 8a2.5 2.5 0 0 0 5 .3c1.2 1 2 2.6 2 4.2a4.5 4.5 0 0 1-9 0c0-5 4.5-6.7 4.5-12.5Z" />
  </Base>
);

export const IconGlobe = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5Z" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Base>
);

export const IconSwap = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4.5v15M7 19.5l-3-3M7 4.5l3 3M17 19.5v-15M17 4.5l3 3M17 19.5l-3-3" />
  </Base>
);

export const IconArchive = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1.2" />
    <path d="M5 8.5v10h14v-10M10 12.5h4" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />
  </Base>
);

export const IconShare = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v6.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-1.5" />
  </Base>
);

export const IconSeat = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 4.5h5a2 2 0 0 1 2 2v7H8.5A1.5 1.5 0 0 1 7 12V5.5a1 1 0 0 1 1-1Z" />
    <path d="M6 13.5h11.5a1.5 1.5 0 0 1 1.5 1.5v1.5H6.5M8.5 16.5v3M16.5 16.5v3" />
  </Base>
);

export const IconWifiOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4l16 16M8.5 16a5 5 0 0 1 5.6-.8M5.3 12.6a9.5 9.5 0 0 1 3.4-2M18.7 12.6a9.5 9.5 0 0 0-4.6-2.4M2.5 9.3A14 14 0 0 1 6 7M21.5 9.3A14 14 0 0 0 10 5.6" />
    <circle cx="12" cy="19" r=".8" fill="currentColor" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
  </Base>
);

export const IconRoute = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="17.5" r="2" />
    <circle cx="18" cy="6.5" r="2" />
    <path d="M7.5 16c3-1.5 2-5 5-6.5s3.5-1.5 4-2" strokeDasharray="2 2.4" />
  </Base>
);

export const IconStar = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 4 2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.6l-4.7 2.7 1.1-5.2-3.9-3.6 5.2-.6Z" />
  </Base>
);
