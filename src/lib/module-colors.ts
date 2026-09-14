// Per-module accent palette — Decide (blue), Connect (green), Learn (gold,
// matches the sitewide default accent), Deliver (amber). Shared between each
// module's ThemeWrap (CSS custom-property overrides, see learn-theme.tsx for
// the original pattern) and the homepage's module-network diagram, which
// paints each node in its own module's color to make the "connected but
// distinct" ecosystem visible even when every module isn't open at once.
export type ModuleKey = "decide" | "connect" | "learn" | "deliver";

export const MODULE_COLORS: Record<ModuleKey, { accent: string; strong: string }> = {
  decide: { accent: "#4a90e2", strong: "#7ab3f0" },
  connect: { accent: "#3fd67a", strong: "#7bf1a8" },
  learn: { accent: "#c9a256", strong: "#e0bd6e" },
  deliver: { accent: "#f2a83e", strong: "#f7c274" },
};
