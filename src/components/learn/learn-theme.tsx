import type { CSSProperties, ReactNode } from "react";

// Learn gets its own scoped palette (warm brass/gold, near-black vignette)
// — the same warm gold as the sitewide default accent, deepened into a
// dedicated near-black backdrop so Learn reads as its own place rather
// than a generic form, matching how Decide/Connect/Deliver each get
// their own module color. Every component under /learn reads the same
// --accent/--bg/etc. custom properties as the rest of the app (via
// Tailwind's `@theme inline` mapping in globals.css), so overriding them
// on this one wrapper re-themes all of Learn for free — nothing else on
// the site is touched.
const LEARN_THEME_VARS = {
  "--bg": "#120d05",
  "--surface": "#1c150a",
  "--surface-2": "#241b0d",
  "--border": "#362913",
  "--ink": "#f7f0e2",
  "--muted": "#a89572",
  "--accent": "#c9a256",
  "--accent-strong": "#e6c274",
  "--accent-ink": "#14100a",
} as CSSProperties;

export function LearnThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        ...LEARN_THEME_VARS,
        background: "radial-gradient(circle at 50% -10%, #3a2c12 0%, #120d05 55%, #0a0704 100%)",
      }}
    >
      {children}
    </div>
  );
}
