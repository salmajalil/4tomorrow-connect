"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

// Shown on every Decide page once a project exists (diagnostic, scenarios,
// scenario detail) — a constant reminder that the same project is one
// click away in the other modules, with its data already loaded there
// (Learn/Deliver read transformationId today; Connect pre-fills industry
// and description from it too, see src/app/connect/page.tsx).
export function ModuleCrossLinks({ transformationId }: { transformationId: string }) {
  const { t } = useLanguage();
  const cl = t.decide.crossLinks;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted">{cl.label}</span>
      <Link
        href={`/connect?transformationId=${transformationId}`}
        className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink transition hover:border-accent/50"
      >
        {t.nav.connect} →
      </Link>
      <Link
        href={`/learn?transformationId=${transformationId}`}
        className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink transition hover:border-accent/50"
      >
        {t.nav.learn} →
      </Link>
      <Link
        href={`/deliver?transformationId=${transformationId}`}
        className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink transition hover:border-accent/50"
      >
        {t.nav.deliver} →
      </Link>
    </div>
  );
}
