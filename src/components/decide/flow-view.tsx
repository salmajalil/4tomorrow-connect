"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { ComputedBadge } from "@/components/computed-badge";
import { createClient } from "@/lib/supabase/client";
import { parseJsonResponse } from "@/lib/parse-json-response";
import {
  FLOW_CSV_HEADER,
  FLOW_CSV_TEMPLATE,
  emptyLevers,
  flowInputsSignature,
  parseFlowCsv,
  validateFlowInputs,
  type FlowLevers,
  type FlowResult,
  type FlowStepInput,
} from "@/lib/decide-flow-calc";

// D02 — Cartographie dynamique. Les chiffres affichés viennent toujours de
// la réponse de /api/decide/flow (calcul serveur déterministe, voir
// src/lib/decide-flow-calc.ts) — ce composant ne calcule jamais rien
// localement, même pour l'aperçu. Aucune IA n'intervient dans cet outil.
type FlowState = "vide" | "incomplet" | "calcul_impossible" | "resultat" | "a_revoir";

let nextStepSeq = 1;
function newStepId(): string {
  return `new-${Date.now()}-${nextStepSeq++}`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function downloadTemplate() {
  const blob = new Blob([FLOW_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cartographie-modele.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function FlowView({ transformationId }: { transformationId: string }) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<FlowStepInput[]>([]);
  const [demand, setDemand] = useState(0);
  const [levers, setLevers] = useState<FlowLevers>(emptyLevers());
  const [result, setResult] = useState<FlowResult | null>(null);
  const [resultSignature, setResultSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [showHow, setShowHow] = useState(false);
  const [actionCreated, setActionCreated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/decide/flow?transformationId=${transformationId}`);
        const { data } = await parseJsonResponse(res);
        if (cancelled) return;
        const flow = data.flow as {
          demand: number;
          steps: FlowStepInput[];
          levers: FlowLevers;
          result: FlowResult | null;
        } | null;
        if (flow) {
          setDemand(flow.demand);
          setSteps(flow.steps);
          setLevers(flow.levers);
          setResult(flow.result);
          if (flow.result) setResultSignature(flowInputsSignature(flow.steps, flow.demand, flow.levers));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transformationId]);

  const validationErrors = useMemo(() => validateFlowInputs(steps, demand), [steps, demand]);
  const currentSignature = useMemo(() => flowInputsSignature(steps, demand, levers), [steps, demand, levers]);

  const state: FlowState = useMemo(() => {
    if (steps.length === 0) return "vide";
    if (validationErrors.length > 0) {
      return validationErrors.some((e) => e.includes("obligatoire")) ? "incomplet" : "calcul_impossible";
    }
    if (result && resultSignature !== null && resultSignature !== currentSignature) return "a_revoir";
    return "resultat";
  }, [steps.length, validationErrors, result, resultSignature, currentSignature]);

  function updateStep(id: string, patch: Partial<FlowStepInput>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: newStepId(), name: "", process: 0, wait: 0, capacity: 1 }]);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setLevers((prev) => {
      const waitCut = { ...prev.waitCut };
      const capAdd = { ...prev.capAdd };
      delete waitCut[id];
      delete capAdd[id];
      return { waitCut, capAdd };
    });
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { steps: parsed, errors } = parseFlowCsv(text);
      setCsvErrors(errors);
      if (errors.length === 0) {
        setSteps(parsed);
        setLevers(emptyLevers());
      }
    };
    reader.readAsText(file);
  }

  async function compute() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/decide/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, demand, steps, levers }),
      });
      const { data } = await parseJsonResponse(res);
      if (!res.ok) throw new Error((data.error as string) || "Une erreur est survenue.");
      setResult(data.result as FlowResult);
      setResultSignature(flowInputsSignature(steps, demand, levers));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  async function createAction() {
    if (!result) return;
    const title = `Lever le goulot : ${result.current.bottleneck.name} (${fmt(result.current.bottleneck.capacity)} vs ${fmt(demand)} pièces/jour demandées)`;
    await createClient().from("actions").insert({ transformation_id: transformationId, title, source_module: "decide_flow" });
    setActionCreated(true);
  }

  if (loading) {
    return <div className="mt-10 h-32 animate-pulse rounded-xl border border-border bg-surface-2" />;
  }

  const stateBadge: Record<FlowState, { label: string; className: string }> = {
    vide: { label: "Vide", className: "bg-surface-2 text-muted" },
    incomplet: { label: "Incomplet", className: "bg-accent/15 text-accent-strong" },
    calcul_impossible: { label: "Calcul impossible", className: "bg-danger/15 text-danger" },
    resultat: { label: "Résultat", className: "bg-success/15 text-success" },
    a_revoir: { label: "À revoir", className: "bg-danger/15 text-danger" },
  };

  const title =
    state === "resultat" || state === "a_revoir"
      ? result
        ? `Délai total : ${fmt(result.current.lead)} j — goulot : ${result.current.bottleneck.name} (${fmt(result.current.bottleneck.capacity)} vs ${fmt(demand)} demandé)`
        : "Cartographie du processus"
      : "Cartographie du processus";

  return (
    <section className="mt-10 border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Cartographie dynamique</Eyebrow>
          <h2 className="mt-3 font-display text-2xl text-ink sm:text-3xl">{title}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${stateBadge[state].className}`}>
          {stateBadge[state].label}
        </span>
      </div>

      {state === "a_revoir" && (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-ink">
          Les données ont changé depuis le dernier calcul — les chiffres ci-dessous datent du calcul précédent. Relance le calcul pour les mettre à jour.
        </p>
      )}

      {/* Graphique — délai par étape (traitement + attente), goulot en évidence */}
      {result && (state === "resultat" || state === "a_revoir") && (
        <div className={`mt-5 rounded-xl border border-border bg-surface p-4 ${state === "a_revoir" ? "opacity-60" : ""}`}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Délai par étape (jours)</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {steps.map((s) => {
              const maxLead = Math.max(...steps.map((st) => st.process + st.wait), 1);
              const isBottleneck = s.id === result.current.bottleneck.id;
              return (
                <div key={s.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                  <span className={`truncate text-sm ${isBottleneck ? "font-semibold text-danger" : "text-body"}`}>
                    {s.name || "(sans nom)"}
                    {isBottleneck && " · goulot"}
                  </span>
                  <div className="flex h-2.5 flex-1 overflow-hidden bg-surface-2">
                    <div className="h-full" style={{ width: `${(s.process / maxLead) * 100}%`, background: "var(--accent)" }} title={`Traitement : ${fmt(s.process)} j`} />
                    <div className="h-full" style={{ width: `${(s.wait / maxLead) * 100}%`, background: "var(--muted)" }} title={`Attente : ${fmt(s.wait)} j`} />
                  </div>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted">{fmt(s.process + s.wait)} j</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ background: "var(--accent)" }} /> Traitement</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ background: "var(--muted)" }} /> Attente</span>
          </div>

          {Object.values(levers.waitCut).some((v) => v > 0) || Object.values(levers.capAdd).some((v) => v > 0) ? (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <Stat label="Délai actuel" value={`${fmt(result.current.lead)} j`} />
              <Stat label="Délai simulé" value={`${fmt(result.simulated.lead)} j`} />
              <Stat label="Gain" value={`${result.gainDays >= 0 ? "-" : "+"}${fmt(Math.abs(result.gainDays))} j`} accent={result.gainDays > 0} />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <Stat label="Délai total" value={`${fmt(result.current.lead)} j`} />
              <Stat label="Part d'attente" value={`${fmt(result.current.waitShare)} %`} />
              <Stat
                label="Couverture demande"
                value={result.current.demandCovered ? "Couverte" : `Manque ${fmt(result.current.deficit)} p/j`}
                accent={!result.current.demandCovered}
              />
            </div>
          )}
        </div>
      )}

      {/* Graphique — capacité par étape face à la demande, goulot en évidence */}
      {result && (state === "resultat" || state === "a_revoir") && (
        <div className={`mt-5 rounded-xl border border-border bg-surface p-4 ${state === "a_revoir" ? "opacity-60" : ""}`}>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Capacité par étape {result.current.demandCovered ? "— demande couverte" : `— goulot : ${result.current.bottleneck.name}`}
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {(() => {
              const maxCap = Math.max(demand, ...result.simSteps.map((s) => s.capacity), 1) * 1.1;
              return steps.map((s, i) => {
                const sim = result.simSteps[i];
                const isBottleneck = s.id === result.current.bottleneck.id;
                return (
                  <div key={s.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <span className={`truncate text-sm ${isBottleneck ? "font-semibold text-danger" : "text-body"}`}>{s.name || "(sans nom)"}</span>
                    <div className="relative h-2.5 flex-1 overflow-hidden bg-surface-2">
                      {sim.capacity > s.capacity && (
                        <div className="absolute inset-y-0 left-0 h-full bg-accent/30" style={{ width: `${(sim.capacity / maxCap) * 100}%` }} />
                      )}
                      <div
                        className="absolute inset-y-0 left-0 h-full"
                        style={{ width: `${(s.capacity / maxCap) * 100}%`, background: isBottleneck ? "var(--danger)" : "var(--accent)" }}
                        title={`Capacité : ${fmt(s.capacity)} p/j`}
                      />
                      <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${(demand / maxCap) * 100}%` }} title={`Demande : ${fmt(demand)} p/j`} />
                    </div>
                    <span className="text-right font-mono text-[11px] tabular-nums text-muted">
                      {fmt(sim.capacity)}
                      {sim.capacity > s.capacity && <span className="text-accent"> (+{fmt(sim.capacity - s.capacity)})</span>}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ background: "var(--danger)" }} /> Goulot actuel</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-accent/30" /> Capacité ajoutée (simulation)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-ink" /> Demande ({fmt(demand)} p/j)</span>
          </div>
        </div>
      )}

      {/* Données modifiables */}
      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Étapes (traitement, attente en jours · capacité en pièces/jour)</p>

        {steps.length === 0 && <p className="mt-2 text-sm text-muted">Aucune étape pour l&apos;instant — ajoute-les manuellement ou importe un fichier CSV.</p>}

        <div className="mt-3 flex flex-col gap-2">
          {steps.map((s) => (
            <div key={s.id} className="grid grid-cols-2 gap-2 border border-border bg-surface p-3 sm:grid-cols-[1fr_5rem_5rem_6rem_auto] sm:items-center">
              <input
                value={s.name}
                onChange={(e) => updateStep(s.id, { name: e.target.value })}
                placeholder="Nom de l'étape"
                className="col-span-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none sm:col-span-1"
              />
              <NumberField label="Traitement" value={s.process} onChange={(v) => updateStep(s.id, { process: v })} />
              <NumberField label="Attente" value={s.wait} onChange={(v) => updateStep(s.id, { wait: v })} />
              <NumberField label="Capacité" value={s.capacity} onChange={(v) => updateStep(s.id, { capacity: v })} />
              <button type="button" onClick={() => removeStep(s.id)} className="self-start text-xs text-muted hover:text-danger sm:self-center">
                Retirer
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={addStep} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50">
            + Ajouter une étape
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvFile(file);
              e.target.value = "";
            }}
            className="hidden"
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50">
            Importer un CSV
          </button>
          <button type="button" onClick={downloadTemplate} className="text-sm font-medium text-muted underline underline-offset-2 hover:text-accent">
            Télécharger le modèle
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">Format attendu : {FLOW_CSV_HEADER}</p>

        {csvErrors.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger/5 p-3 text-xs text-danger">
            {csvErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        <label className="mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Demande (pièces/jour)</span>
          <input
            type="number"
            value={demand}
            onChange={(e) => setDemand(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          {demand === 0 && <span className="text-xs text-muted">Ex : 120 pièces/jour demandées.</span>}
        </label>

        {validationErrors.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-danger">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {/* Leviers « et si » — appliqués uniquement à la copie simulée, jamais aux données ci-dessus */}
        {steps.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Leviers « et si » (simulation, ne modifie pas les données ci-dessus)</p>
            <div className="mt-3 flex flex-col gap-3">
              {steps.map((s) => (
                <div key={s.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_1fr] sm:items-center">
                  <span className="truncate text-sm text-body">{s.name || "(sans nom)"}</span>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Réduire l&apos;attente
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={levers.waitCut[s.id] ?? 0}
                      onChange={(e) => setLevers((prev) => ({ ...prev, waitCut: { ...prev.waitCut, [s.id]: Number(e.target.value) } }))}
                      className="flex-1 accent-accent"
                    />
                    <span className="w-9 text-right tabular-nums text-ink">{levers.waitCut[s.id] ?? 0}%</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    + Capacité
                    <input
                      type="number"
                      min={0}
                      value={levers.capAdd[s.id] ?? 0}
                      onChange={(e) => setLevers((prev) => ({ ...prev, capAdd: { ...prev.capAdd, [s.id]: Number(e.target.value) } }))}
                      className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-right text-xs tabular-nums text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={compute}
          disabled={saving || validationErrors.length > 0}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "…" : state === "a_revoir" ? "Recalculer" : "Calculer"}
        </button>
        {result && (
          <button
            type="button"
            onClick={createAction}
            disabled={actionCreated}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 disabled:opacity-50"
          >
            {actionCreated ? "Action créée ✓" : "Créer l'action"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => setShowHow((v) => !v)}
        className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong"
      >
        <span aria-hidden className={`transition-transform ${showHow ? "rotate-90" : ""}`}>
          ›
        </span>
        Comment c&apos;est calculé
      </button>
      {showHow && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">
          <p>Délai = somme des temps de traitement + somme des temps d&apos;attente, sur toutes les étapes.</p>
          <p>Goulot = l&apos;étape dont la capacité (pièces/jour) est la plus faible ; elle détermine le débit réel face à la demande.</p>
          <p>Les leviers « et si » (réduction d&apos;attente, capacité additionnelle) s&apos;appliquent uniquement à une copie simulée des données — les étapes saisies ci-dessus ne sont jamais modifiées.</p>
          <p>Aucune valeur de cette page n&apos;est générée par l&apos;IA : tout vient des données saisies ou importées.</p>
        </div>
      )}
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-muted">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

// Résultat de computeFlow (decide-flow-calc.ts) — jamais saisi, marqué
// « Calculé » pour le distinguer des champs de saisie des étapes/leviers.
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <ComputedBadge />
      </div>
      <p className={`mt-1 font-display text-xl tabular-nums ${accent ? "text-danger" : "text-ink"}`}>{value}</p>
    </div>
  );
}
