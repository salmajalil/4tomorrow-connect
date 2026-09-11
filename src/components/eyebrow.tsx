import type { ReactNode } from "react";

// Small gold label + short underline — the recurring section-header motif
// from the 4 Tomorrow brand deck ("THE INSIGHT —", "OUR VISION —").
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {children}
      </span>
      <span className="h-[2px] w-7 bg-accent" />
    </div>
  );
}
