import type { ReactNode } from "react";
import { ModuleEcosystemStrip } from "@/components/module-ecosystem-strip";

// Deliver deliberately has no scoped palette — it stays on the sitewide
// default (near-black + brass gold, see :root in globals.css), same as
// Learn. Only Decide (blue) and Connect (green) keep a distinct module
// color; Deliver and Learn anchor back to the shared brand identity
// instead. Kept as its own wrapper (rather than removed outright) so the
// gold ecosystem strip stays consistent across all four modules.
export function DeliverThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <ModuleEcosystemStrip current="deliver" />
      {children}
    </div>
  );
}
