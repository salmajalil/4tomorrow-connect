"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { BrandTheme } from "@/types/database";

// Re-skins the app in a client's real brand colors by overriding the same
// CSS custom properties globals.css defines on :root (--bg, --accent, …).
// Every Tailwind utility already resolves through these variables (see
// `@theme inline` in globals.css), so setting them on documentElement is
// enough to re-theme the whole app live, no per-component changes needed.
const CSS_VAR_MAP: Record<keyof Omit<BrandTheme, "sourceLabel" | "generatedAt">, string> = {
  bg: "--bg",
  surface: "--surface",
  surfaceAlt: "--surface-2",
  border: "--border",
  ink: "--ink",
  muted: "--muted",
  accent: "--accent",
  accentStrong: "--accent-strong",
  accentInk: "--accent-ink",
};

type BrandThemeController = {
  theme: BrandTheme | null;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  applyTheme: (theme: BrandTheme) => void;
  clearTheme: () => void;
};

const BrandThemeContext = createContext<BrandThemeController | null>(null);

export function BrandThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: BrandTheme | null;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<BrandTheme | null>(initialTheme);
  const [enabled, setEnabled] = useState(!!initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled && theme) {
      for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
        root.style.setProperty(cssVar, theme[key as keyof typeof CSS_VAR_MAP]);
      }
    } else {
      for (const cssVar of Object.values(CSS_VAR_MAP)) {
        root.style.removeProperty(cssVar);
      }
    }
  }, [enabled, theme]);

  function applyTheme(next: BrandTheme) {
    setTheme(next);
    setEnabled(true);
  }

  function clearTheme() {
    setTheme(null);
    setEnabled(false);
  }

  return (
    <BrandThemeContext.Provider value={{ theme, enabled, setEnabled, applyTheme, clearTheme }}>
      {children}
    </BrandThemeContext.Provider>
  );
}

export function useBrandTheme() {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) throw new Error("useBrandTheme must be used within BrandThemeProvider");
  return ctx;
}
