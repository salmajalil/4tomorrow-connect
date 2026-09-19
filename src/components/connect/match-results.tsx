"use client";

import { useState } from "react";
import type { ModelOutput, MatchOutput } from "@/lib/matching";
import { EcosystemDiagram } from "@/components/connect/ecosystem-diagram";
import { Eyebrow } from "@/components/eyebrow";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";

const CATEGORY_ORDER: MatchOutput["category"][] = [
  "technology",
  "startup",
  "expert",
  "partner",
  "funding",
];

function SourceBadge({ source, t }: { source: MatchOutput["source"]; t: Dictionary }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        source === "registry" ? "bg-success/15 text-success" : "bg-accent/15 text-accent-strong"
      }`}
    >
      {source === "registry" ? t.connect.results.registrySource : t.connect.results.webSource}
    </span>
  );
}

function MatchCard({ match, t }: { match: MatchOutput; t: Dictionary }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">{match.name}</p>
        <SourceBadge source={match.source} t={t} />
      </div>
      <p className="text-sm text-muted">{match.reason}</p>
      <p className="text-xs text-muted">
        <span className="font-medium text-ink">{t.connect.results.gapAddressed}</span> {match.gapAddressed}
      </p>
      {(match.website || match.contactEmail) && (
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {match.website && (
            <a
              href={match.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              {t.connect.results.viewSite}
            </a>
          )}
          {match.contactEmail && (
            <a
              href={`mailto:${match.contactEmail}`}
              className="font-medium text-accent underline underline-offset-2"
            >
              {match.contactEmail}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchResults({
  result,
  projectLabel,
}: {
  result: ModelOutput;
  projectLabel?: string;
}) {
  const { t } = useLanguage();
  const results = t.connect.results;
  const [showAllMatches, setShowAllMatches] = useState(false);
  const CATEGORY_LABELS: Record<MatchOutput["category"], string> = {
    technology: results.categoryTechnology,
    startup: results.categoryStartup,
    expert: results.categoryExpert,
    partner: results.categoryPartner,
    funding: results.categoryFunding,
  };
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    matches: result.matches.filter((m) => m.category === category),
  })).filter((group) => group.matches.length > 0);
  const totalMatches = result.matches.length;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <Eyebrow>{results.strategicBrief}</Eyebrow>
        <p className="mt-3 text-base leading-relaxed text-ink">{result.strategicBrief}</p>
      </section>

      <section>
        <Eyebrow>{results.goodIdeas}</Eyebrow>
        <ol className="mt-3 flex flex-col gap-2">
          {result.goodIdeas.map((idea, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                {i + 1}
              </span>
              <p className="text-sm text-ink">{idea}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Eyebrow>{results.yourEcosystem}</Eyebrow>
        <div className="mt-3">
          <EcosystemDiagram
            projectLabel={projectLabel ?? results.yourProject}
            groups={byCategory.map(({ category, matches }) => ({
              category,
              label: CATEGORY_LABELS[category],
              count: matches.length,
            }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Eyebrow>{results.matches}</Eyebrow>

        {!showAllMatches && (
          <>
            <div className="flex flex-wrap gap-2">
              {byCategory.map(({ category, matches }) => (
                <span
                  key={category}
                  className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-ink"
                >
                  {CATEGORY_LABELS[category]} <span className="text-muted">· {matches.length}</span>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {byCategory.map(({ category, matches }) => (
                <MatchCard key={category} match={matches[0]} t={t} />
              ))}
            </div>
          </>
        )}

        {showAllMatches &&
          byCategory.map(({ category, matches }) => (
            <div key={category}>
              <h3 className="text-base font-semibold text-ink">{CATEGORY_LABELS[category]}</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {matches.map((match, i) => (
                  <MatchCard key={`${category}-${i}`} match={match} t={t} />
                ))}
              </div>
            </div>
          ))}

        <button
          type="button"
          onClick={() => setShowAllMatches((v) => !v)}
          className="flex items-center gap-1.5 self-start text-sm font-semibold text-accent hover:text-accent-strong"
        >
          <span aria-hidden className={`transition-transform ${showAllMatches ? "rotate-90" : ""}`}>
            ›
          </span>
          {showAllMatches ? results.hideAllMatches : `${results.showAllMatches} (${totalMatches})`}
        </button>
      </section>
    </div>
  );
}
