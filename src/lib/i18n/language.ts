import "server-only";
import { cookies } from "next/headers";
import type { Language } from "@/types/database";
import { LANGUAGE_COOKIE, DEFAULT_LANGUAGE } from "./constants";

// Cookie is the single source of truth for the active language — read here
// on every server-rendered page/route so first paint already matches what
// the client will show (no flash of the wrong language). Signed-in users
// also get it mirrored to profiles.language (see LanguageToggle) so the
// preference exists server-side for future cross-device use, but the
// cookie is what actually drives rendering.
export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  const value = store.get(LANGUAGE_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}
