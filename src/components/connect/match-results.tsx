import type { ModelOutput, MatchOutput } from "@/lib/matching";
import { EcosystemDiagram } from "@/components/connect/ecosystem-diagram";
import { Eyebrow } from "@/components/eyebrow";

const CATEGORY_LABELS: Record<MatchOutput["category"], string> = {
  technology: "Technologies",
  startup: "Startups",
  expert: "Experts & consultants",
  partner: "Partenaires",
  funding: "Financement & subventions",
};

const CATEGORY_ORDER: MatchOutput["category"][] = [
  "technology",
  "startup",
  "expert",
  "partner",
  "funding",
];

function SourceBadge({ source }: { source: MatchOutput["source"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        source === "registry" ? "bg-success/15 text-success" : "bg-accent/15 text-accent-strong"
      }`}
    >
      {source === "registry" ? "Répertoire" : "Recherche web"}
    </span>
  );
}

function MatchCard({ match }: { match: MatchOutput }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">{match.name}</p>
        <SourceBadge source={match.source} />
      </div>
      <p className="text-sm text-muted">{match.reason}</p>
      <p className="text-xs text-muted">
        <span className="font-medium text-ink">Gap adressé :</span> {match.gapAddressed}
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
              Voir le site ↗
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
  projectLabel = "Ton projet",
}: {
  result: ModelOutput;
  projectLabel?: string;
}) {
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    matches: result.matches.filter((m) => m.category === category),
  })).filter((group) => group.matches.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <Eyebrow>Strategic Brief</Eyebrow>
        <p className="mt-3 text-base leading-relaxed text-ink">{result.strategicBrief}</p>
      </section>

      <section>
        <Eyebrow>Good Ideas for Your Mission</Eyebrow>
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
        <Eyebrow>Ton écosystème</Eyebrow>
        <div className="mt-3">
          <EcosystemDiagram
            projectLabel={projectLabel}
            groups={byCategory.map(({ category, matches }) => ({
              category,
              label: CATEGORY_LABELS[category],
              count: matches.length,
            }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <Eyebrow>Matches</Eyebrow>
        {byCategory.map(({ category, matches }) => (
          <div key={category}>
            <h3 className="text-base font-semibold text-ink">{CATEGORY_LABELS[category]}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {matches.map((match, i) => (
                <MatchCard key={`${category}-${i}`} match={match} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
