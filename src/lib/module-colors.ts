// Per-module accent palette — Decide (blue) and Connect (green) get a
// signature color; Learn gets its own bright golden-yellow (brighter than
// the sitewide default brass); Deliver stays on the plain sitewide default
// (near-black + brass gold, see :root in globals.css) since it has no
// ThemeWrap override of its own. Shared between each module's ThemeWrap
// (CSS custom-property overrides, see decide-theme.tsx for the pattern)
// and the homepage's module-network diagram, which paints each node in its
// own module's color to make the "connected but distinct" ecosystem
// visible even when every module isn't open at once.
export type ModuleKey = "decide" | "connect" | "learn" | "deliver";

export const MODULE_COLORS: Record<ModuleKey, { accent: string; strong: string }> = {
  decide: { accent: "#4a90e2", strong: "#7ab3f0" },
  connect: { accent: "#3fd67a", strong: "#7bf1a8" },
  learn: { accent: "#f0b93c", strong: "#f7d06a" },
  deliver: { accent: "#c9a256", strong: "#e0bd6e" },
};
