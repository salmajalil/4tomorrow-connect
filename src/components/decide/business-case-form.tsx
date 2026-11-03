"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";

// D05 — Business case, en option (désactivée par défaut, checkbox décochée
// à l'ouverture). Les chiffres affichés viennent toujours de la réponse de
// /api/decide/business-case (calcul serveur déterministe) — ce composant ne
// calcule jamais rien localement, même pour l'aperçu.
type Result = { netAnnual: number; paybackYears: number | null; npv: number | null };

export function BusinessCaseForm({ transformationId, trajectoryId }: { transformationId: string; trajectoryId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [capex, setCapex] = useState("");
  const [annualGains, setAnnualGains] = useState("");
  const [annualCosts, setAnnualCosts] = useState("");
  const [horizonYears, setHorizonYears] = useState("3");
  const [discountRatePercent, setDiscountRatePercent] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function compute() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/decide/business-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transformationId,
          trajectoryId,
          enabled: true,
          capex: Number(capex),
          annualGains: Number(annualGains),
          annualCosts: Number(annualCosts),
          horizonYears: Number(horizonYears),
          discountRatePercent: discountRatePercent.trim() === "" ? null : Number(discountRatePercent),
        }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || "Une erreur est survenue.");
      setResult(data.result as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border border-border bg-surface p-6">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Business case (optionnel)
      </label>

      {enabled && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Investissement (k€)" value={capex} onChange={setCapex} />
            <Field label="Gains annuels (k€)" value={annualGains} onChange={setAnnualGains} />
            <Field label="Coûts annuels (k€)" value={annualCosts} onChange={setAnnualCosts} />
            <Field label="Horizon (années)" value={horizonYears} onChange={setHorizonYears} />
            <Field label="Taux d'actualisation % (facultatif)" value={discountRatePercent} onChange={setDiscountRatePercent} />
          </div>

          <button
            type="button"
            onClick={compute}
            disabled={loading}
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            {loading ? "…" : "Calculer"}
          </button>

          {error && <p className="text-sm text-danger">{error}</p>}

          {result && (
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Gain net annuel" value={`${result.netAnnual} k€`} />
              <Stat
                label="Retour sur investissement"
                value={result.paybackYears !== null ? `${result.paybackYears} ans` : "Jamais rentable"}
              />
              <Stat label="VAN" value={result.npv !== null ? `${result.npv} k€` : "— (aucun taux saisi)"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-display text-xl text-ink tabular-nums">{value}</p>
    </div>
  );
}
