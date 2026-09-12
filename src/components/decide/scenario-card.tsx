"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ScenarioOutput } from "@/lib/decide";
import type { IndicatorEntry, IndicatorFeedback, TrajectoryIndicators } from "@/types/database";

export type ScenarioWithId = ScenarioOutput & { trajectoryId: string };

const SLOT_LABELS = ["A", "B", "C"];

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

// A validated indicator (confidence "verified") displays as a plain fact.
function ValidatedIndicatorChip({ indicatorKey, entry }: { indicatorKey: string; entry: IndicatorEntry }) {
  return (
    <div className="flex min-w-[7rem] flex-col items-center gap-0.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{indicatorKey}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{String(entry.value)}</p>
      <span className="text-[10px] text-success">Validé ✓</span>
    </div>
  );
}

// Everything that ISN'T "verified" (estimate or unknown) never shows a raw
// number by default — an AI guess presented next to a hard fact reads as a
// hard fact. Instead: the number stays masked behind an explicit "afficher"
// toggle, and a small note thread is the only way to move it to "verified".
// Sending a note is both the record of who said what and, at the same time,
// how the value gets entered/confirmed — there's no separate "edit" step,
// since it's the same person (the transformation owner) doing both.
function IndicatorReview({
  trajectoryId,
  indicatorKey,
  entry,
  notes,
  indicatorsSnapshot,
  feedbackSnapshot,
  onIndicatorsChange,
  onFeedbackChange,
}: {
  trajectoryId: string;
  indicatorKey: string;
  entry: IndicatorEntry;
  notes: { note: string; at: string }[];
  indicatorsSnapshot: TrajectoryIndicators;
  feedbackSnapshot: IndicatorFeedback;
  onIndicatorsChange: (next: TrajectoryIndicators) => void;
  onFeedbackChange: (next: IndicatorFeedback) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    const updatedIndicators: TrajectoryIndicators = {
      ...indicatorsSnapshot,
      [indicatorKey]: { value: trimmed, confidence: "verified" },
    };
    const updatedFeedback: IndicatorFeedback = {
      ...feedbackSnapshot,
      [indicatorKey]: [...(feedbackSnapshot[indicatorKey] ?? []), { note: trimmed, at: new Date().toISOString() }],
    };
    await createClient()
      .from("trajectories")
      .update({ indicators: updatedIndicators, indicators_feedback: updatedFeedback })
      .eq("id", trajectoryId);
    onIndicatorsChange(updatedIndicators);
    onFeedbackChange(updatedFeedback);
    setDraft("");
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-surface-2/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{indicatorKey}</p>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent-strong">
          Non validé
        </span>
      </div>

      {entry.confidence === "estimate" ? (
        revealed ? (
          <p className="text-sm text-muted">
            Estimation IA (sans source) : <span className="font-medium text-ink">{String(entry.value)}</span>{" "}
            <button type="button" onClick={() => setRevealed(false)} className="text-xs text-accent underline underline-offset-2">
              masquer
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="self-start text-xs font-medium text-accent underline underline-offset-2"
          >
            Afficher l&apos;estimation IA (non validée)
          </button>
        )
      ) : (
        <p className="text-sm text-muted">Non estimable par l&apos;IA à partir des informations fournies.</p>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border pt-2 text-xs text-muted">
          {notes.map((n, i) => (
            <li key={i}>
              <span className="font-medium text-ink">{n.note}</span>{" "}
              <span className="text-[10px]">— {new Date(n.at).toLocaleDateString("fr-FR")}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Confirmer ou indiquer la vraie valeur"
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="shrink-0 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}

function TechStackRow({ item }: { item: ScenarioOutput["techStack"][number] }) {
  const maturityMatch = /(\d+)\s*\/?\s*(?:-|à|to)?\s*(\d+)?/.exec(item.maturity);
  const level = maturityMatch ? Number(maturityMatch[1]) : null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink">{item.name}</p>
        <span className="text-xs text-accent-strong">
          {item.maturityScale} — {item.maturity}
        </span>
      </div>
      {level !== null && (
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < level ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted">{item.detail}</p>
      <p className="mt-1 text-xs text-ink">Bénéfice : {item.benefit}</p>
    </div>
  );
}

export function ScenarioCard({
  scenario,
  index,
  selected,
  onSelect,
}: {
  scenario: ScenarioWithId;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [indicators, setIndicators] = useState<TrajectoryIndicators>(scenario.indicators);
  const [feedback, setFeedback] = useState<IndicatorFeedback>({});

  const indicatorEntries = Object.entries(indicators);
  const validatedEntries = indicatorEntries.filter(([, entry]) => entry.confidence === "verified");
  const unvalidatedEntries = indicatorEntries.filter(([, entry]) => entry.confidence !== "verified");

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-5 transition ${
        selected ? "border-accent bg-accent/5 shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-sm font-semibold text-accent-strong">
          {SLOT_LABELS[index] ?? index + 1}
        </span>
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">{scenario.stance}</span>
          <h3 className="mt-0.5 font-display text-xl text-ink">{scenario.name}</h3>
        </div>
      </div>

      <p className="text-sm text-muted">{scenario.description}</p>

      {validatedEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {validatedEntries.map(([key, entry]) => (
            <ValidatedIndicatorChip key={key} indicatorKey={key} entry={entry} />
          ))}
        </div>
      )}

      {unvalidatedEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Données financières à valider — jamais affichées comme un fait tant que non confirmées
          </p>
          {unvalidatedEntries.map(([key, entry]) => (
            <IndicatorReview
              key={key}
              trajectoryId={scenario.trajectoryId}
              indicatorKey={key}
              entry={entry}
              notes={feedback[key] ?? []}
              indicatorsSnapshot={indicators}
              feedbackSnapshot={feedback}
              onIndicatorsChange={setIndicators}
              onFeedbackChange={setFeedback}
            />
          ))}
        </div>
      )}

      {(scenario.risksSpecific.length > 0 || scenario.opportunitiesSpecific.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {scenario.opportunitiesSpecific.map((o, i) => (
            <span
              key={`opp-${i}`}
              title={o.reason}
              className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
            >
              ↗ {o.name}
            </span>
          ))}
          {scenario.risksSpecific.map((r, i) => (
            <span
              key={`risk-${i}`}
              title={r.reason}
              className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger"
            >
              ⚠ {r.name}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="self-start text-xs font-semibold text-accent underline underline-offset-2"
      >
        {expanded ? "Réduire ▲" : "Voir le détail complet ▼"}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Stack / solutions</h4>
            <div className="mt-2 flex flex-col gap-2">
              {scenario.techStack.map((item, i) => (
                <TechStackRow key={i} item={item} />
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
                          <a
                            href={s.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-accent underline underline-offset-2"
                          >
                            Site ↗
                          </a>
                        )}
                        {s.contactEmail && (
                          <a
                            href={`mailto:${s.contactEmail}`}
                            className="font-medium text-accent underline underline-offset-2"
                          >
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
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline underline-offset-2"
                        >
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Opportunités du scénario
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
                {scenario.opportunitiesSpecific.map((o, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{o.name}</span> — {o.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
