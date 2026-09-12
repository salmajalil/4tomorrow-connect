import type { CSSProperties, ReactNode } from "react";

// Learn gets its own scoped palette (mint/emerald, near-black vignette)
// instead of the sitewide brass "industrial luxury" theme — matching the
// reference product's visual identity, which the rest of 4 Tomorrow
// (Decide, Connect, Control Tower) does not share. Every component under
// /learn reads the same --accent/--bg/etc. custom properties as the rest
// of the app (via Tailwind's `@theme inline` mapping in globals.css), so
// overriding them on this one wrapper re-themes all of Learn for free —
// nothing else on the site is touched.
const LEARN_THEME_VARS = {
  "--bg": "#050f08",
  "--surface": "#0c1912",
  "--surface-2": "#12241a",
  "--border": "#1e3327",
  "--ink": "#eafaf0",
  "--muted": "#84a894",
  "--accent": "#3fd67a",
  "--accent-strong": "#7bf1a8",
  "--accent-ink": "#04140a",
} as CSSProperties;

export function LearnThemeWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 flex-col"
      style={{
        ...LEARN_THEME_VARS,
        background: "radial-gradient(circle at 50% -10%, #123321 0%, #050f08 55%, #030805 100%)",
      }}
    >
      {children}
    </div>
  );
}
