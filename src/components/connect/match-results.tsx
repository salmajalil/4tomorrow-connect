import type { ModelOutput, MatchOutput } from "@/lib/matching";

const CATEGORY_LABELS: Record<MatchOutput["category"], string> = {
  technology: "Technologies",
  startup: "Startups",
  expert: "Experts & consultants",
  partner: "Partenaires",
};

const CATEGORY_ORDER: MatchOutput["category"][] = ["technology", "startup", "expert", "partner"];

function SourceBadge({ source }: { source: MatchOutput["source"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        source === "registry"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-sky-100 text-sky-800"
      }`}
    >
      {source === "registry" ? "Répertoire" : "Recherche web"}
    </span>
  );
}

function MatchCard({ match }: { match: MatchOutput }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-neutral-900">{match.name}</p>
        <SourceBadge source={match.source} />
      </div>
      <p className="text-sm text-neutral-600">{match.reason}</p>
      <p className="text-xs text-neutral-500">
        <span className="font-medium text-neutral-700">Gap adressé :</span> {match.gapAddressed}
      </p>
      {(match.website || match.contactEmail) && (
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {match.website && (
            <a
              href={match.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-900 underline underline-offset-2"
            >
              Voir le site ↗
            </a>
          )}
          {match.contactEmail && (
            <a
              href={`mailto:${match.contactEmail}`}
              className="font-medium text-neutral-900 underline underline-offset-2"
            >
              {match.contactEmail}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchResults({ result }: { result: ModelOutput }) {
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    matches: result.matches.filter((m) => m.category === category),
  })).filter((group) => group.matches.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Strategic Brief
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-800">{result.strategicBrief}</p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Good Ideas for Your Mission
        </h2>
        <ol className="mt-2 flex flex-col gap-2">
          {result.goodIdeas.map((idea, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm text-neutral-800">{idea}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Matches</h2>
        {byCategory.map(({ category, matches }) => (
          <div key={category}>
            <h3 className="text-base font-semibold text-neutral-900">
              {CATEGORY_LABELS[category]}
            </h3>
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
