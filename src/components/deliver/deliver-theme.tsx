import type { CSSProperties, ReactNode } from "react";

// Deliver's scoped palette (amber/execution-energy) — same mechanism as
// Learn's ThemeWrap: every component under /deliver reads the same
// --accent/--bg/etc. custom properties as the rest of the app (via
// Tailwind's `@theme inline` mapping in globals.css), so overriding them
// on this one wrapper re-themes all of Deliver for free.
const DELIVER_THEME_VARS = {
  "--bg": "#150f06",
  "--surface": "#1f170a",
  "--surface-2": "#291f0c",
  "--border": "#3d2f10",
  "--ink": "#faf3e0",
  "--muted": "#ad9868",
  "--accent": "#f2a83e",
  "--accent-strong": "#f7c274",
  "--accent-ink": "#160f04",
} as CSSProperties;

export function DeliverThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        ...DELIVER_THEME_VARS,
        background: "radial-gradient(circle at 50% -10%, #402c0c 0%, #150f06 55%, #0b0704 100%)",
      }}
    >
      {children}
    </div>
  );
}
