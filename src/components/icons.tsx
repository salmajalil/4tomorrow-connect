import type { SVGProps } from "react";

// Small shared line-icon set — same stroke style as the nav/module icons
// used across the app (24x24, currentColor stroke, no fill) — replaces
// functional emojis (🔥 🏆 📅 ⚠ 🔍) that read as prototype-grade rather
// than a real icon system.
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1.5 1.5 2 3.5 2 5a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6.5C10 5.5 11 4 12 2Z" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" />
      <path d="M12 13v3M9 20h6M10 20v-2h4v2" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.8 17a1.8 1.8 0 0 0 1.6 2.7h15.2a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 4 Tomorrow line-icon set — one drawing language for modules, domains,
// industries and statuses (24×24 grid, 1.6 stroke, round joins), replacing
// every emoji in the interface. Use <Icon name="…" />; names are plain
// strings so server-side data files (lib/*.ts) can reference an icon
// without importing JSX.
// ---------------------------------------------------------------------------

const ICON_PATHS = {
  // Modules
  decide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11Z" />
    </>
  ),
  connect: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8.5 7h7M7.3 9.2l3.5 6.6M16.7 9.2l-3.5 6.6" />
    </>
  ),
  learn: (
    <>
      <path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1Z" />
      <path d="M12 6.5V20" />
    </>
  ),
  deliver: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h11l-2 3.5L16 12H5" />
    </>
  ),
  tower: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </>
  ),
  // Domains
  factory: (
    <>
      <path d="M3 21V11l5-3v3l5-3v3l5-3v13Z" />
      <path d="M3 21h18M7 17h2M11 17h2M15 17h2" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <path d="M7 15h10" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  // Industries
  plane: (
    <>
      <path d="M3 14h12l5-3h1.5L20 15.5H3Z" />
      <path d="M7 14l2-5h2l-1 5M11 15.5 9 19.5h2l3-4" />
    </>
  ),
  car: (
    <>
      <path d="M3 15v-2l2.5-4h10l3.5 3.5H21V15Z" />
      <circle cx="7.5" cy="15.5" r="1.8" />
      <circle cx="16.5" cy="15.5" r="1.8" />
    </>
  ),
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6Z" />,
  health: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 20C5 11 10 5 20 4c0 10-5 15-14 15Z" />
      <path d="M5 20l8-8" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M2 21h20M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2ZM13 9h4l3 3v4h-7" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0Z" />
      <path d="M12 17v4" />
    </>
  ),
  boat: (
    <>
      <path d="M3 14h18l-2.5 4.5H5.5Z" />
      <path d="M6 14l1.5-4h9l2 4M10 10V7h4v3M12 7V4" />
    </>
  ),
  // Status & actions
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  estimate: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 13c1.5-2 3-2 4.5 0s3 2 4.5 0" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <path d="M9.8 9.5a2.3 2.3 0 1 1 3 2.2c-.6.3-.8.7-.8 1.3M12 16.5h.01" />
    </>
  ),
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  document: (
    <>
      <path d="M6 3h8l4 4v14H6Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  map: (
    <>
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  checklist: (
    <>
      <path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" />
      <path d="M11 6h9M11 12h9M11 18h9" />
    </>
  ),
  chart: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="12" width="3" height="7" />
      <rect x="10.5" y="8" width="3" height="11" />
      <rect x="16" y="4" width="3" height="15" />
    </>
  ),
  toolbox: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M9 8V5h6v3M3 13h18M10 13v2h4v-2" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.8 17a1.8 1.8 0 0 0 1.6 2.7h15.2a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v11h14V9M10 13h4" />
    </>
  ),
  home: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, strokeWidth = 1.6, ...props }: IconProps & { name: IconName }) {
  return (
    <svg {...base(props)} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true}>
      {ICON_PATHS[name]}
    </svg>
  );
}
