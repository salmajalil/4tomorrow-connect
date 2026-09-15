import type { CSSProperties, ReactNode } from "react";
import { ModuleEcosystemStrip } from "@/components/module-ecosystem-strip";

// Decide's scoped palette (cool blue, strategic/decision-making) —
// same mechanism as Learn's ThemeWrap: every component under /decide
// reads the same --accent/--bg/etc. custom properties as the rest of the
// app (via Tailwind's `@theme inline` mapping in globals.css), so
// overriding them on this one wrapper re-themes all of Decide for free.
const DECIDE_THEME_VARS = {
  "--bg": "#060b14",
  "--surface": "#0d1420",
  "--surface-2": "#121b2c",
  "--border": "#1c2940",
  "--ink": "#eaf1fb",
  "--muted": "#7f93b0",
  "--accent": "#4a90e2",
  "--accent-strong": "#7ab3f0",
  "--accent-ink": "#04070c",
} as CSSProperties;

export function DecideThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        ...DECIDE_THEME_VARS,
        background: "radial-gradient(circle at 50% -10%, #16294a 0%, #060b14 55%, #030509 100%)",
      }}
    >
      <ModuleEcosystemStrip current="decide" />
      {children}
    </div>
  );
}
