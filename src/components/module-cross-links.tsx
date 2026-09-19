"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import type { ModuleKey } from "@/lib/module-colors";

// Shown on every module's page once a project exists — a constant
// reminder that the same project is one click away in the other
// modules, with its data already loaded there (Learn/Deliver/Connect all
// read ?transformationId= and pre-fill or reuse the linked project).
const MODULE_KEYS: ModuleKey[] = ["decide", "connect", "learn", "deliver"];
const MODULE_HREF: Record<ModuleKey, string> = {
  decide: "/decide",
  connect: "/connect",
  learn: "/learn",
  deliver: "/deliver",
};

export function ModuleCrossLinks({ current, transformationId }: { current: ModuleKey; transformationId: string }) {
  const { t } = useLanguage();
  const others = MODULE_KEYS.filter((k) => k !== current);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted">{t.common.continueWith}</span>
      {others.map((key) => (
        <Link
          key={key}
          href={`${MODULE_HREF[key]}?transformationId=${transformationId}`}
          className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink transition hover:border-accent/50"
        >
          {t.nav[key]} →
        </Link>
      ))}
    </div>
  );
}
