"use client";

import { useEffect, useMemo, useState } from "react";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  businessCaseFormValuesFromInput,
  businessCaseInputsSignature,
  readBusinessCaseForm,
  type BusinessCaseField,
  type BusinessCaseFormValues,
} from "@/lib/decide-business-case-calc";
import type { BusinessCase } from "@/types/database";

// D05 — Business case, en option (désactivée par défaut, checkbox décochée
// à l'ouverture tant qu'aucun business case n'a été enregistré). Les
// chiffres affichés viennent toujours de la réponse de
// /api/decide/business-case (calcul serveur déterministe) ou de la ligne
// business_cases relue au montage — ce composant ne calcule jamais rien
// localement. Gabarit sur le modèle de D02 (flow-view.tsx) : vide /
// incomplet / calcul impossible / résultat / à revoir (signature des
// entrées comparée à celle du résultat affiché).
type Result = { netAnnual: number; paybackYears: number | null; npv: number | null; cumulativeByYear: number[] };
type BusinessCaseState = "vide" | "incomplet" | "calcul_impossible" | "pret" | "resultat" | "a_revoir";
type BcDict = Dictionary["decide"]["businessCase"];

const EMPTY_VALUES: BusinessCaseFormValues = {
  capex: "",
  annualGains: "",
  annualCosts: "",
  horizonYears: "3",
  discountRatePercent: "",
};

const FIELDS: BusinessCaseField[] = ["capex", "annualGains", "annualCosts", "horizonYears", "discountRatePercent"];

// Graphique de flux nets cumulés — mêmes nombres que cumulativeByYear
// (déjà calculés et testés côté serveur), juste encodés visuellement au
// lieu d'être seulement résumés en trois chiffres.
function CumulativeFlowChart({
  cumulativeByYear,
  paybackYears,
  bc,
}: {
  cumulativeByYear: number[];
  paybackYears: number | null;
  bc: BcDict;
}) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={bc.chartAriaLabel}>
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />
      <text x={left - 6} y={y(0) + 4} textAnchor="end" className="fill-muted text-xs">
        0
      </text>
      {Array.from({ length: years + 1 }, (_, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted text-xs">
          {i === 0 ? bc.chartInitial : bc.chartYear.replace("{n}", String(i))}
        </text>
      ))}
      {paybackYears !== null && paybackYears <= years && (
        <line x1={x(paybackYears)} x2={x(paybackYears)} y1={top} y2={H - bottom} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {cumulativeByYear.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === years ? 4 : 2.5} fill="var(--accent)" />
      ))}
      <text x={x(years) + 6} y={y(last) + 4} className={`text-xs font-semibold ${last >= 0 ? "fill-success" : "fill-danger"}`}>
        {fmt(last)} k€
      </text>
    </svg>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function rowToResult(row: BusinessCase): Result {
  return {
    netAnnual: Number(row.net_annual),
    paybackYears: row.payback_years === null ? null : Number(row.payback_years),
    npv: row.npv === null ? null : Number(row.npv),
    cumulativeByYear: (row.cumulative_by_year ?? []).map(Number),
  };
}

export function BusinessCaseForm({ transformationId, trajectoryId }: { transformationId: string; trajectoryId: string }) {
  const { t } = useLanguage();
  const bc = t.decide.businessCase;
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<BusinessCaseFormValues>(EMPTY_VALUES);
  const [result, setResult] = useState<Result | null>(null);
  const [resultSignature, setResultSignature] = useState<string | null>(null);
  const [benefitLinked, setBenefitLinked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionCreated, setActionCreated] = useState(false);

  // Relecture du dernier business case enregistré pour cette trajectoire
  // (même principe que FlowView pour process_flows) — la table n'était
  // jusque-là jamais relue, chaque visite repartait de zéro.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/decide/business-case?trajectoryId=${trajectoryId}`);
        const { data } = await parseJsonResponse(res);
        if (cancelled) return;
        const row = (data.businessCase ?? null) as BusinessCase | null;
        if (row) {
          const input = {
            capex: Number(row.capex),
            annualGains: Number(row.annual_gains),
            annualCosts: Number(row.annual_costs),
            horizonYears: Number(row.horizon_years),
            discountRatePercent: row.discount_rate_percent === null ? null : Number(row.discount_rate_percent),
          };
          setEnabled(row.enabled);
          setValues(businessCaseFormValuesFromInput(input));
          setResult(rowToResult(row));
          setResultSignature(businessCaseInputsSignature(input));
        }
      } catch {
        // Lecture best-effort : sans ligne relue, le formulaire part vide.
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trajectoryId]);

  const reading = useMemo(() => readBusinessCaseForm(values), [values]);
  const currentSignature = reading.input ? businessCaseInputsSignature(reading.input) : null;

  const state: BusinessCaseState = useMemo(() => {
    if (result && resultSignature !== null) {
      return resultSignature === currentSignature ? "resultat" : "a_revoir";
    }
    return reading.status;
  }, [result, resultSignature, currentSignature, reading.status]);

  function setField(field: BusinessCaseField, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setActionCreated(false);
  }

  async function compute() {
    if (!reading.input) return;
    const input = reading.input;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/decide/business-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, trajectoryId, enabled: true, ...input }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || bc.errorGeneric);
      setResult(data.result as Result);
      setResultSignature(businessCaseInputsSignature(input));
      setBenefitLinked(data.benefitLinked === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : bc.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  async function createAction() {
    if (!result || !reading.input) return;
    const title = bc.actionTitle.replace("{capex}", fmt(reading.input.capex)).replace("{net}", fmt(result.netAnnual));
    await createClient().from("actions").insert({ transformation_id: transformationId, title, source_module: "decide_business_case" });
    setActionCreated(true);
  }

  const fieldLabel = (f: BusinessCaseField) => bc[f];
  const showResult = result !== null && (state === "resultat" || state === "a_revoir");

  const stateBadge: Record<BusinessCaseState, { label: string; className: string }> = {
    vide: { label: bc.stateEmpty, className: "bg-surface-2 text-muted" },
    incomplet: { label: bc.stateIncomplete, className: "bg-accent/15 text-accent-strong" },
    calcul_impossible: { label: bc.stateImpossible, className: "bg-danger/15 text-danger" },
    pret: { label: bc.stateReady, className: "bg-accent/15 text-accent-strong" },
    resultat: { label: bc.stateResult, className: "bg-success/15 text-success" },
    a_revoir: { label: bc.stateStale, className: "bg-danger/15 text-danger" },
  };

  const title =
    showResult && result
      ? result.paybackYears !== null
        ? bc.titlePayback.replace("{n}", fmt(result.paybackYears)).replace("{net}", fmt(result.netAnnual))
        : bc.titleNeverProfitable.replace("{net}", fmt(result.netAnnual))
      : bc.titleEmpty;

  return (
    <div className="mt-6 border border-border bg-surface p-6">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={enabled}
          disabled={loadingSaved}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        {bc.toggle}
      </label>

      {enabled && (
        <div className="mt-4 flex flex-col gap-4">
          {/* 1. Réponse chiffrée en titre + état du gabarit */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="font-display text-xl text-ink sm:text-2xl">{title}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${stateBadge[state].className}`}>
              {stateBadge[state].label}
            </span>
          </div>

          {state === "a_revoir" && (
            <p className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-ink">{bc.staleNotice}</p>
          )}

          {/* 2. Graphique (et chiffres clés) — uniquement depuis le dernier calcul serveur */}
          {showResult && result && (
            <div className={`flex flex-col gap-4 ${state === "a_revoir" ? "opacity-60" : ""}`}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label={bc.netAnnual} value={`${fmt(result.netAnnual)} k€`} />
                <Stat
                  label={bc.payback}
                  value={result.paybackYears !== null ? bc.paybackYears.replace("{n}", fmt(result.paybackYears)) : bc.neverProfitable}
                />
                <Stat label={bc.npv} value={result.npv !== null ? `${fmt(result.npv)} k€` : bc.npvNoRate} />
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{bc.cumulativeTitle}</p>
                <div className="mt-3">
                  <CumulativeFlowChart cumulativeByYear={result.cumulativeByYear} paybackYears={result.paybackYears} bc={bc} />
                </div>
                {result.paybackYears !== null && <p className="mt-1 text-xs text-muted">{bc.paybackLineHint}</p>}
              </div>
            </div>
          )}

          {/* 3. Données modifiables */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <Field
                key={f}
                label={fieldLabel(f)}
                value={values[f]}
                onChange={(v) => setField(f, v)}
                placeholder={bc[`${f}Placeholder`]}
                invalid={state !== "vide" && (reading.missing.includes(f) || reading.invalid.includes(f))}
              />
            ))}
          </div>

          {state === "vide" && <p className="text-sm text-muted">{bc.emptyHint}</p>}
          {state === "incomplet" && (
            <p className="text-sm text-accent-strong">{bc.incompleteHint.replace("{fields}", reading.missing.map(fieldLabel).join(", "))}</p>
          )}
          {state === "calcul_impossible" && (
            <p className="text-sm text-danger">{bc.impossibleHint.replace("{fields}", reading.invalid.map(fieldLabel).join(", "))}</p>
          )}
          {state === "pret" && <p className="text-sm text-muted">{bc.readyHint}</p>}
          {state === "a_revoir" && reading.status !== "pret" && (
            <p className="text-sm text-danger">
              {reading.missing.length > 0
                ? bc.incompleteHint.replace("{fields}", reading.missing.map(fieldLabel).join(", "))
                : bc.impossibleHint.replace("{fields}", reading.invalid.map(fieldLabel).join(", "))}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={compute}
              disabled={loading || reading.status !== "pret" || state === "resultat"}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              {loading ? "…" : state === "a_revoir" ? bc.recompute : bc.compute}
            </button>

            {/* 4. Créer l'action — seulement sur un résultat à jour */}
            {state === "resultat" && (
              <button
                type="button"
                onClick={() => void createAction()}
                disabled={actionCreated}
                className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent-strong disabled:opacity-60"
              >
                {actionCreated ? bc.actionCreated : bc.createAction}
              </button>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {benefitLinked && state === "resultat" && <p className="text-sm text-success">{bc.benefitLinked}</p>}

          {/* 5. Comment c'est calculé */}
          <details className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-accent-strong">{bc.howCalculatedTitle}</summary>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
              <p>{bc.howCalculatedNet}</p>
              <p>{bc.howCalculatedPayback}</p>
              <p>{bc.howCalculatedNpv}</p>
              <p>{bc.howCalculatedEmpty}</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={`rounded-lg border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none ${
          invalid ? "border-danger/60" : "border-border"
        }`}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-display text-xl text-ink tabular-nums">{value}</p>
    </div>
  );
}
