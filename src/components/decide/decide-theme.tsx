import type { ReactNode } from "react";
import { ModuleEcosystemStrip } from "@/components/module-ecosystem-strip";
import { moduleBackground, moduleThemeVars } from "@/lib/module-colors";

// Decide's scoped accent: only --accent / --accent-strong change (see
// lib/module-colors.ts), so the module keeps the 4 Tomorrow ink-and-gold
// identity while staying recognisable.
export function DecideThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col" style={{ ...moduleThemeVars("decide"), background: moduleBackground("decide") }}>
      <ModuleEcosystemStrip current="decide" />
      {children}
    </div>
  );
}
