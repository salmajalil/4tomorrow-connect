import type { CSSProperties, ReactNode } from "react";
import { ModuleEcosystemStrip } from "@/components/module-ecosystem-strip";

// Learn's scoped palette — a brighter, warmer golden-yellow than the
// sitewide default brass accent (#c9a256), so Learn reads as its own
// place (matching Decide=blue, Connect=green) while staying in the
// site's gold family, unlike Deliver which anchors on the plain default.
const LEARN_THEME_VARS = {
  "--bg": "#140f04",
  "--surface": "#201908",
  "--surface-2": "#2b210b",
  "--border": "#3f3110",
  "--ink": "#fbf3de",
  "--muted": "#b8a06a",
  "--accent": "#f0b93c",
  "--accent-strong": "#f7d06a",
  "--accent-ink": "#160f04",
} as CSSProperties;

export function LearnThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        ...LEARN_THEME_VARS,
        background: "radial-gradient(circle at 50% -10%, #3f2f0a 0%, #140f04 55%, #0a0703 100%)",
      }}
    >
      <ModuleEcosystemStrip current="learn" />
      {children}
    </div>
  );
}
