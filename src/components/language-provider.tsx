"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Language } from "@/types/database";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { LANGUAGE_COOKIE } from "@/lib/i18n/constants";

const LanguageContext = createContext<{ language: Language; t: Dictionary; setLanguage: (l: Language) => void } | null>(
  null
);

// initialLanguage comes from the server (cookie read in the root layout),
// so first paint already matches what the client renders — no flash of
// the wrong language. Toggling writes the same cookie so the next
// server-rendered page (after router.refresh()) picks it up too.
export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  function setLanguage(next: Language) {
    setLanguageState(next);
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000`;
  }

  return (
    <LanguageContext.Provider value={{ language, t: getDictionary(language), setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
