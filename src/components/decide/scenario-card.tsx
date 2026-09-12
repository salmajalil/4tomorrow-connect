"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ScenarioOutput } from "@/lib/decide";
import type { IndicatorEntry, IndicatorFeedback, IndicatorFeedbackValue, TrajectoryIndicators } from "@/types/database";

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

// Every indicator carries its own confidence (see src/lib/decide.ts) instead
// of being shown as a flat fact. "unknown" never has a fabricated number —
// it's an inline invite to fill in the real one. "estimate" is shown but
// asks the viewer to confirm or dispute it, feeding a lightweight
// human-in-the-loop signal rather than presenting a guess as certainty.
function IndicatorTile({
  trajectoryId,
  indicatorKey,
  entry,
  feedbackValue,
  indicatorsSnapshot,
  feedbackSnapshot,
  onIndicatorsChange,
  onFeedbackChange,
}: {
  trajectoryId: string;
  indicatorKey: string;
  entry: IndicatorEntry;
  feedbackValue: IndicatorFeedbackValue | undefined;
  indicatorsSnapshot: TrajectoryIndicators;
  feedbackSnapshot: IndicatorFeedback;
  onIndicatorsChange: (next: TrajectoryIndicators) => void;
  onFeedbackChange: (next: IndicatorFeedback) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveExpertValue() {
    const trimmed = draftValue.trim();
    if (!trimmed) return;
    setSaving(true);
    const updated: TrajectoryIndicators = {
      ...indicatorsSnapshot,
      [indicatorKey]: { value: trimmed, confidence: "verified" },
    };
    await createClient().from("trajectories").update({ indicators: updated }).eq("id", trajectoryId);
    onIndicatorsChange(updated);
    setSaving(false);
    setEditing(false);
  }

  async function vote(value: IndicatorFeedbackValue) {
    const updated: IndicatorFeedback = { ...feedbackSnapshot, [indicatorKey]: value };
    onFeedbackChange(updated);
    await createClient().from("trajectories").update({ indicators_feedback: updated }).eq("id", trajectoryId);
  }

  if (entry.confidence === "unknown" && entry.value === null && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-w-[7rem] flex-col items-center gap-0.5 rounded-lg border border-dashed border-border bg-surface-2/50 px-3 py-2 text-center"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{indicatorKey}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">À renseigner ✎</p>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex min-w-[9rem] flex-col gap-1 rounded-lg border border-accent/40 bg-surface-2 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{indicatorKey}</p>
        <input
          autoFocus
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          placeholder="Valeur réelle"
          className="w-full rounded border border-border bg-surface px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveExpertValue}
            disabled={saving}
            className="text-[11px] font-semibold text-accent disabled:opacity-40"
          >
            Enregistrer
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-muted">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-[7rem] flex-col items-center gap-0.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{indicatorKey}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{String(entry.value)}</p>
      {entry.confidence === "verified" && <span className="text-[10px] text-success">Vérifié ✓</span>}
      {entry.confidence === "estimate" &&
        (feedbackValue ? (
          <span className="text-[10px] text-muted">
            {feedbackValue === "confirmed" ? "Confirmé ✓" : "Signalé ⚠"}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted">≈ estimation</span>
            <button
              type="button"
              onClick={() => vote("confirmed")}
              aria-label="Confirmer cette estimation"
              className="text-xs leading-none"
            >
              👍
            </button>
            <button
              type="button"
              onClick={() => vote("disputed")}
              aria-label="Signaler cette estimation comme inexacte"
              className="text-xs leading-none"
            >
              👎
            </button>
          </div>
        ))}
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

      <div className="flex flex-wrap gap-2">
        {Object.entries(indicators).map(([key, entry]) => (
          <IndicatorTile
            key={key}
            trajectoryId={scenario.trajectoryId}
            indicatorKey={key}
            entry={entry}
            feedbackValue={feedback[key]}
            indicatorsSnapshot={indicators}
            feedbackSnapshot={feedback}
            onIndicatorsChange={setIndicators}
            onFeedbackChange={setFeedback}
          />
        ))}
      </div>

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
