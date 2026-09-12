// No "server-only"/"use client" restriction — imported by both server
// (language.ts, via cookies()) and client (language-provider.tsx, via
// document.cookie) code, so it has to stay restriction-free itself.
export const LANGUAGE_COOKIE = "lang";
export const DEFAULT_LANGUAGE = "fr" as const;
