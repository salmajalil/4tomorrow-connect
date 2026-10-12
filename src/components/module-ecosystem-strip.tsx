"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { Icon } from "@/components/icons";
import { MODULE_COLORS, type ModuleKey } from "@/lib/module-colors";

const MODULE_KEYS: ModuleKey[] = ["decide", "connect", "learn", "deliver"];
const MODULE_HREF: Record<ModuleKey, string> = {
  decide: "/decide",
  connect: "/connect",
  learn: "/learn",
  deliver: "/deliver",
};

// The four modules as one connected path, shown at the top of every module
// page on desktop: where you are, and what comes before and after. On a
// phone the bottom tab bar plays this role, so the strip is hidden there.
export function ModuleEcosystemStrip({ current }: { current: ModuleKey }) {
  const { t } = useLanguage();

  return (
    <nav aria-label={t.nav.mainNavLabel} className="hidden border-b border-border bg-bg/60 md:block">
      <ol className="mx-auto flex max-w-6xl items-center gap-0 px-8 py-2.5">
        {MODULE_KEYS.map((key, i) => {
          const active = key === current;
          const color = MODULE_COLORS[key].accent;
          return (
            <li key={key} className="flex flex-1 items-center gap-3">
              <Link
                href={MODULE_HREF[key]}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <Icon name={key} className="h-4 w-4" style={{ color: active ? color : undefined }} />
                {t.nav[key]}
              </Link>
              {i < MODULE_KEYS.length - 1 && (
                <span aria-hidden className="h-px flex-1" style={{ background: active ? color : "var(--border)" }} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
