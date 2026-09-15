"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import type { ModuleKey } from "@/lib/module-colors";

// A thin gold thread rendered at the top of every module (inside each
// ThemeWrap) — deliberately hardcoded gold, never `var(--accent)`, so it
// reads the same regardless of the module's own color (blue/green/gold).
// It's the visual answer to "are the modules connected or not": every
// module always shows the other three, one click away, with the current
// one highlighted.
const MODULE_KEYS: ModuleKey[] = ["decide", "connect", "learn", "deliver"];
const MODULE_HREF: Record<ModuleKey, string> = {
  decide: "/decide",
  connect: "/connect",
  learn: "/learn",
  deliver: "/deliver",
};

export function ModuleEcosystemStrip({ current }: { current: ModuleKey }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3 overflow-x-auto border-b border-[#e0bd6e]/15 bg-black/25 px-4 py-2 text-xs whitespace-nowrap">
      <Link href="/" className="shrink-0 font-display font-semibold tracking-wide text-[#e0bd6e]">
        4 TOMORROW
      </Link>
      <span aria-hidden className="shrink-0 text-[#e0bd6e]/30">
        ·
      </span>
      <div className="flex shrink-0 items-center gap-3">
        {MODULE_KEYS.map((key) => (
          <Link
            key={key}
            href={MODULE_HREF[key]}
            className={`flex items-center gap-1.5 transition ${
              key === current ? "font-semibold text-[#e0bd6e]" : "text-[#e0bd6e]/45 hover:text-[#e0bd6e]/80"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${key === current ? "bg-[#e0bd6e]" : "bg-[#e0bd6e]/40"}`}
            />
            {t.nav[key]}
          </Link>
        ))}
      </div>
    </div>
  );
}
