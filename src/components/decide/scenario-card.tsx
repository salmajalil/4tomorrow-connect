import type { ScenarioOutput } from "@/lib/decide";

export type ScenarioWithId = ScenarioOutput & { trajectoryId: string };

const CATEGORY_LABELS: Record<string, string> = {
  technology: "Technologie",
  startup: "Startup",
  expert: "Expert",
  partner: "Partenaire",
  funding: "Financement",
};

function SourceBadge({ source }: { source: "registry" | "web_search" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        source === "registry" ? "bg-success/15 text-success" : "bg-accent/15 text-accent-strong"
      }`}
    >
      {source === "registry" ? "Répertoire" : "Recherche web"}
    </span>
  );
}

export function ScenarioCard({
  scenario,
  selected,
  onSelect,
}: {
  scenario: ScenarioWithId;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-5 rounded-xl border p-5 transition ${
        selected ? "border-accent bg-accent/5 shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-surface"
      }`}
    >
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">{scenario.stance}</span>
        <h3 className="mt-1 font-display text-2xl text-ink">{scenario.name}</h3>
        <p className="mt-2 text-sm text-muted">{scenario.description}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(scenario.indicators).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{key}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{String(value)}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Stack / solutions</h4>
        <div className="mt-2 flex flex-col gap-2">
          {scenario.techStack.map((item, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink">{item.name}</p>
                <span className="text-xs text-accent-strong">
                  {item.maturityScale} — {item.maturity}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{item.detail}</p>
              <p className="mt-1 text-xs text-ink">Bénéfice : {item.benefit}</p>
            </div>
          ))}
        </div>
      </div>

      {scenario.suppliers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Fournisseurs & partenaires
          </h4>
          <div className="mt-2 flex flex-col gap-2">
            {scenario.suppliers.map((s, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">
                    {s.name}{" "}
                    <span className="text-xs font-normal text-muted">
                      ({CATEGORY_LABELS[s.category] ?? s.category})
                    </span>
                  </p>
                  <SourceBadge source={s.source} />
                </div>
                <p className="mt-1 text-xs text-muted">{s.reason}</p>
                {(s.website || s.contactEmail) && (
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {s.website && (
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                        Site ↗
                      </a>
                    )}
                    {s.contactEmail && (
                      <a href={`mailto:${s.contactEmail}`} className="font-medium text-accent underline underline-offset-2">
                        {s.contactEmail}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenario.regulations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Régulations / standards applicables
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
            {scenario.regulations.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{r.name}</span> — {r.description}
                {r.sourceUrl && (
                  <>
                    {" "}
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                      source ↗
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Briefing exécutif</h4>
        <p className="mt-1 text-sm text-ink">{scenario.executiveBriefing}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Risques du scénario</h4>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
            {scenario.risksSpecific.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{r.name}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Opportunités du scénario</h4>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
            {scenario.opportunitiesSpecific.map((o, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{o.name}</span> — {o.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className={`self-start rounded-lg px-5 py-2 text-sm font-semibold transition ${
          selected
            ? "bg-accent text-accent-ink"
            : "border border-accent text-accent hover:bg-accent hover:text-accent-ink"
        }`}
      >
        {selected ? "Scénario choisi ✓" : "Choisir ce scénario"}
      </button>
    </div>
  );
}
