"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { createClient } from "@/lib/supabase/client";
import type { Language } from "@/types/database";

// userId is only passed by Nav when someone is signed in — mirrors the
// choice to profiles.language too (that column exists specifically for
// this) so the preference has a server-side home for future cross-device
// use, even though the cookie is what actually drives rendering today.
export function LanguageToggle({ userId }: { userId?: string | null }) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();

  async function choose(next: Language) {
    if (next === language) return;
    setLanguage(next);
    if (userId) {
      await createClient().from("profiles").upsert({ id: userId, language: next });
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5 text-[11px] font-semibold">
      <button
        type="button"
        onClick={() => choose("fr")}
        aria-pressed={language === "fr"}
        className={`rounded-full px-2 py-0.5 transition ${language === "fr" ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={language === "en"}
        className={`rounded-full px-2 py-0.5 transition ${language === "en" ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
      >
        EN
      </button>
    </div>
  );
}
