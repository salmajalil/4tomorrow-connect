"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";

// D05 — Business case, en option (désactivée par défaut, checkbox décochée
// à l'ouverture). Les chiffres affichés viennent toujours de la réponse de
// /api/decide/business-case (calcul serveur déterministe) — ce composant ne
// calcule jamais rien localement, même pour l'aperçu.
type Result = { netAnnual: number; paybackYears: number | null; npv: number | null; cumulativeByYear: number[] };

// Graphique de flux nets cumulés — mêmes nombres que cumulativeByYear
// (déjà calculés et testés côté serveur), juste encodés visuellement au
// lieu d'être seulement résumés en trois chiffres.
function CumulativeFlowChart({ cumulativeByYear, paybackYears }: { cumulativeByYear: number[]; paybackYears: number | null }) {
  const W = 640;
  const H = 180;
  const left = 56;
  const right = 16;
  const top = 12;
  const bottom = 24;
  const years = cumulativeByYear.length - 1;
  const lo = Math.min(0, ...cumulativeByYear);
  const hi = Math.max(0, ...cumulativeByYear);
  const pad = (hi - lo) * 0.1 || 10;
  const loPad = lo - pad;
  const hiPad = hi + pad;
  const x = (i: number) => left + (i / years) * (W - left - right);
  const y = (v: number) => top + (1 - (v - loPad) / (hiPad - loPad)) * (H - top - bottom);
  const points = cumulativeByYear.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = cumulativeByYear[cumulativeByYear.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Flux nets cumulés sur l'horizon">
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />
      <text x={left - 6} y={y(0) + 4} textAnchor="end" className="fill-muted text-[10px]">
        0
      </text>
      {Array.from({ length: years + 1 }, (_, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">
          {i === 0 ? "Initial" : `An ${i}`}
        </text>
      ))}
      {paybackYears !== null && paybackYears <= years && (
        <line x1={x(paybackYears)} x2={x(paybackYears)} y1={top} y2={H - bottom} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {cumulativeByYear.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === years ? 4 : 2.5} fill="var(--accent)" />
      ))}
      <text x={x(years) + 6} y={y(last) + 4} className={`text-[11px] font-semibold ${last >= 0 ? "fill-success" : "fill-danger"}`}>
        {fmt(last)} k€
      </text>
    </svg>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

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
            <div className="mt-2 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Gain net annuel" value={`${result.netAnnual} k€`} />
                <Stat
                  label="Retour sur investissement"
                  value={result.paybackYears !== null ? `${result.paybackYears} ans` : "Jamais rentable"}
                />
                <Stat label="VAN" value={result.npv !== null ? `${result.npv} k€` : "— (aucun taux saisi)"} />
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Flux nets cumulés</p>
                <div className="mt-3">
                  <CumulativeFlowChart cumulativeByYear={result.cumulativeByYear} paybackYears={result.paybackYears} />
                </div>
                {result.paybackYears !== null && (
                  <p className="mt-1 text-xs text-muted">La ligne pointillée marque le retour sur investissement.</p>
                )}
              </div>
              <details className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-accent-strong">Comment c&apos;est calculé</summary>
                <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
                  <p>Gain net annuel = gains bruts − coûts récurrents.</p>
                  <p>Retour sur investissement = investissement / gain net annuel (non actualisé).</p>
                  <p>VAN = somme des flux nets actualisés à chaque année, moins l&apos;investissement initial — calculée seulement si un taux d&apos;actualisation est saisi, jamais par défaut.</p>
                </div>
              </details>
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
