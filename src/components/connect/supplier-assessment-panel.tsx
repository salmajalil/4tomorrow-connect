"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/components/language-provider";
import {
  computeSupplierAssessment,
  type ProofStatus,
  type SupplierAssessmentResult,
  type SupplierCriterion,
  type SupplierPrerequisite,
} from "@/lib/connect-supplier-calc";

// C02 — panneau d'évaluation déterministe d'un fournisseur (match). La
// découverte du candidat reste assistée par IA (src/lib/matching.ts) ;
// tout ce qui se passe ici — éligibilité, score, "recommandé" — est
// calculé en local avec la même fonction pure que le serveur
// (src/lib/connect-supplier-calc.ts) pour un retour immédiat, puis
// recalculé et persisté côté serveur à l'enregistrement (la route fait
// foi, ce calcul local n'est qu'un aperçu).
export function SupplierAssessmentPanel({
  matchId,
  transformationId,
}: {
  matchId: string | null;
  transformationId: string | null;
}) {
  const { t } = useLanguage();
  const a = t.connect.results.assessment;
  const [open, setOpen] = useState(false);
  const [prerequisites, setPrerequisites] = useState<SupplierPrerequisite[]>([]);
  const [criteria, setCriteria] = useState<SupplierCriterion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SupplierAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!matchId || !transformationId) return null;

  const preview = computeSupplierAssessment(prerequisites, criteria);

  function addPrerequisite() {
    setPrerequisites((prev) => [...prev, { label: "", met: false }]);
  }
  function updatePrerequisite(i: number, patch: Partial<SupplierPrerequisite>) {
    setPrerequisites((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removePrerequisite(i: number) {
    setPrerequisites((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { label: "", score: null, proofStatus: "manquant", proofDate: null }]);
  }
  function updateCriterion(i: number, patch: Partial<SupplierCriterion>) {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCriterion(i: number) {
    setCriteria((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/match/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, transformationId, prerequisites, criteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || a.saveError);
      setSaved(data.result as SupplierAssessmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : a.saveError);
    } finally {
      setSaving(false);
    }
  }

  const shown = saved ?? (prerequisites.length > 0 || criteria.length > 0 ? preview : null);

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-accent-strong"
      >
        <Icon name="check" className="h-3.5 w-3.5" />
        {open ? a.hide : a.evaluate}
      </button>

      {shown && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
            <span
              className={`border px-1.5 py-0.5 font-medium ${
                shown.eligible ? "border-success/40 text-success" : "border-danger/40 text-danger"
              }`}
            >
              {shown.eligible ? a.eligible : a.ineligible}
            </span>
            {shown.score !== null && (
              <span className="border border-border px-1.5 py-0.5 text-muted">
                {a.score} {shown.score}/5
              </span>
            )}
            {shown.recommended && <span className="border border-accent bg-accent/10 px-1.5 py-0.5 font-medium text-accent-strong">{a.recommended}</span>}
            {!shown.recommended && shown.missingProofs.length > 0 && (
              <span className="text-muted">{a.missingProofsCount.replace("{n}", String(shown.missingProofs.length))}</span>
            )}
          </div>
          {shown.totalCriteria > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(shown.verifiedCount / shown.totalCriteria) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted">
                {a.coverage} {shown.verifiedCount}/{shown.totalCriteria}
              </span>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{a.prerequisites}</p>
            <div className="flex flex-col gap-1.5">
              {prerequisites.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.met}
                    onChange={(e) => updatePrerequisite(i, { met: e.target.checked })}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePrerequisite(i, { label: e.target.value })}
                    placeholder={a.prerequisiteLabel}
                    className="flex-1 border border-border bg-surface px-2 py-1 text-xs text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => removePrerequisite(i)}
                    aria-label={a.remove}
                    className="px-1 text-sm leading-none text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPrerequisite} className="self-start text-xs text-accent-strong underline-offset-4 hover:underline">
                + {a.addPrerequisite}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{a.criteria}</p>
            <div className="flex flex-col gap-1.5">
              {criteria.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) => updateCriterion(i, { label: e.target.value })}
                    placeholder={a.criterionLabel}
                    className="min-w-0 flex-1 border border-border bg-surface px-2 py-1 text-xs text-ink"
                  />
                  <select
                    value={c.proofStatus}
                    onChange={(e) => updateCriterion(i, { proofStatus: e.target.value as ProofStatus })}
                    className="border border-border bg-surface px-1.5 py-1 text-xs text-ink"
                  >
                    <option value="manquant">{a.statusMissing}</option>
                    <option value="vérifié">{a.statusVerified}</option>
                    <option value="périmé">{a.statusExpired}</option>
                  </select>
                  {c.proofStatus === "vérifié" && (
                    <>
                      <select
                        value={c.score ?? ""}
                        onChange={(e) => updateCriterion(i, { score: e.target.value ? Number(e.target.value) : null })}
                        className="border border-border bg-surface px-1.5 py-1 text-xs text-ink"
                      >
                        <option value="">{a.scorePlaceholder}</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}/5
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={c.proofDate ?? ""}
                        onChange={(e) => updateCriterion(i, { proofDate: e.target.value || null })}
                        className="border border-border bg-surface px-1.5 py-1 text-xs text-ink"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeCriterion(i)}
                    aria-label={a.remove}
                    className="px-1 text-sm leading-none text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addCriterion} className="self-start text-xs text-accent-strong underline-offset-4 hover:underline">
                + {a.addCriterion}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="self-start border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
          >
            {saving ? a.saving : a.save}
          </button>

          <details className="text-[10.5px]">
            <summary className="cursor-pointer font-medium uppercase tracking-wide text-muted">{a.howCalculatedTitle}</summary>
            <p className="mt-1.5 text-muted">{a.howCalculatedBody}</p>
          </details>
        </div>
      )}
    </div>
  );
}
