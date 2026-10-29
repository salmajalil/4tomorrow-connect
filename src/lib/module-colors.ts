import type { CSSProperties } from "react";

// Per-module accent palette, tuned to the printed catalogue: every module
// keeps the same ink ground, surfaces and text, and only its accent changes
// — Decide gold, Connect steel blue, Learn sage, Deliver sand. Same chroma
// and lightness family, so the four read as one product, not four apps.
// Shared between each module's ThemeWrap and every diagram that paints a
// module in its own colour (home network, impact journey, PDF reports).
export type ModuleKey = "decide" | "connect" | "learn" | "deliver";

export const MODULE_COLORS: Record<ModuleKey, { accent: string; strong: string }> = {
  decide: { accent: "#c8955a", strong: "#e0b57f" },
  connect: { accent: "#7fb8c4", strong: "#a8d3dc" },
  learn: { accent: "#9cc08a", strong: "#bfd8b1" },
  deliver: { accent: "#d9c3a5", strong: "#ecdcc4" },
};

// CSS custom-property overrides for a module's ThemeWrap: only the accent
// family changes; components keep reading --accent / --accent-strong, so a
// whole module re-themes without touching any component.
export function moduleThemeVars(key: ModuleKey): CSSProperties {
  const c = MODULE_COLORS[key];
  return {
    "--accent": c.accent,
    "--accent-strong": c.strong,
    "--accent-ink": "#0b0a08",
  } as CSSProperties;
}

// A faint glow of the module colour at the top of the page — enough to
// tell where you are, never enough to change the brand ground.
export function moduleBackground(key: ModuleKey): string {
  const hex = MODULE_COLORS[key].accent;
  return `radial-gradient(ellipse 70% 40% at 50% -5%, ${hex}1f 0%, transparent 70%), var(--bg)`;
}
