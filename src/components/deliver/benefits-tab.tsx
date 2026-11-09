"use client";

// L06 — Réalisation des bénéfices. Initial data comes from the server
// component (src/app/deliver/page.tsx), exactly like every other tab here
// (deliverables, roadmapPhases, priorities) — the effect below only wires
// the realtime subscription and re-fetches on a DB change, it never sets
// state synchronously on mount (same pattern as control-tower-view.tsx).
// Nothing here is AI-generated — every number is either user-entered or
// computed by src/lib/deliver-benefits-calc.ts (pure, tested).
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  compareBenefits,
  compareToTrajectory,
  computeExpectedTrajectory,
  computeItemsTotal,
  computeObservedAnnual,
  resolveTrajectoryWindow,
} from "@/lib/deliver-benefits-calc";
import { useLanguage } from "@/components/language-provider";
import type { BenefitExpectation, BenefitItem, BenefitObservation, RoadmapPhaseEntry } from "@/types/database";

export function BenefitsTab({
  transformationId,
  initialExpectation,
  initialItems,
  initialObservations,
  roadmapPhases = [],
}: {
  transformationId: string;
  initialExpectation: BenefitExpectation | null;
  initialItems: BenefitItem[];
  initialObservations: BenefitObservation[];
  // Roadmap phases (start / target dates of the expected trajectory).
  roadmapPhases?: RoadmapPhaseEntry[];
}) {
  const { t, language } = useLanguage();
  const b = t.deliver.benefits;
  const [expectation, setExpectation] = useState<BenefitExpectation | null>(initialExpectation);
  const [expectedInput, setExpectedInput] = useState(initialExpectation?.expected_annual != null ? String(initialExpectation.expected_annual) : "");
  const [items, setItems] = useState<BenefitItem[]>(initialItems);
  const [observations, setObservations] = useState<BenefitObservation[]>(initialObservations);
  const [newItem, setNewItem] = useState({ label: "", perimeter: "", value: "" });
  const [newObs, setNewObs] = useState({ month: "", value: "" });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: exp }, { data: its }, { data: obs }] = await Promise.all([
      supabase.from("benefit_expectations").select("*").eq("transformation_id", transformationId).maybeSingle(),
      supabase.from("benefit_items").select("*").eq("transformation_id", transformationId).order("created_at"),
      supabase.from("benefit_observations").select("*").eq("transformation_id", transformationId).order("month"),
    ]);
    setExpectation(exp ?? null);
    setExpectedInput(exp?.expected_annual != null ? String(exp.expected_annual) : "");
    setItems(its ?? []);
    setObservations(obs ?? []);
  }, [transformationId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`benefits-${transformationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "benefit_expectations", filter: `transformation_id=eq.${transformationId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "benefit_items", filter: `transformation_id=eq.${transformationId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "benefit_observations", filter: `transformation_id=eq.${transformationId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [transformationId, refresh]);

  async function saveExpected() {
    const value = expectedInput.trim() ? Number(expectedInput) : null;
    await createClient()
      .from("benefit_expectations")
      .upsert({ transformation_id: transformationId, expected_annual: value, source: "manual", updated_at: new Date().toISOString() });
  }

  async function addItem() {
    if (!newItem.label.trim() || !newItem.perimeter.trim() || !newItem.value.trim()) return;
    await createClient()
      .from("benefit_items")
      .insert({ transformation_id: transformationId, label: newItem.label.trim(), perimeter: newItem.perimeter.trim(), value: Number(newItem.value) });
    setNewItem({ label: "", perimeter: "", value: "" });
  }

  async function addObservation() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(newObs.month) || !newObs.value.trim()) return;
    await createClient()
      .from("benefit_observations")
      .upsert({ transformation_id: transformationId, month: newObs.month, value: Number(newObs.value) }, { onConflict: "transformation_id,month" });
    setNewObs({ month: "", value: "" });
  }

  const itemsResult = computeItemsTotal(items.map((i) => ({ label: i.label, perimeter: i.perimeter, value: i.value })));
  const observedResult = computeObservedAnnual(observations.map((o) => ({ month: o.month, value: o.value })));
  // L06 — gabarit « à revoir » : une valeur tapée mais pas encore
  // enregistrée ne compte pas encore dans l'écart ci-dessous.
  const expectedUnsaved = expectedInput !== String(expectation?.expected_annual ?? "");
  const comparison = compareBenefits(expectation?.expected_annual ?? null, observedResult?.observedAnnual ?? null);
  // Expected trajectory at today's date (linear from the project start to
  // the roadmap's target date, baseline 0 for a gain). Missing start, target
  // date, expected value or observed value → no headline, screen unchanged.
  const trajWindow = resolveTrajectoryWindow(roadmapPhases, observations);
  const trajectory = computeExpectedTrajectory({
    startDate: trajWindow.startDate,
    targetDate: trajWindow.targetDate,
    today: new Date().toISOString().slice(0, 10),
    baseline: 0,
    target: expectation?.expected_annual ?? null,
  });
  const vsTrajectory =
    trajectory && comparison.observedAnnual !== null ? compareToTrajectory(comparison.observedAnnual, trajectory.expectedToDate) : null;
  const fmt = (n: number) => new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US").format(n);

  return (
    <div className="flex flex-col gap-6">
      {vsTrajectory && trajectory && (
        <div className="border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{b.trajectoryEyebrow}</p>
          <h2 className="mt-2 font-display text-2xl leading-tight text-ink tabular-nums">
            {fmt(vsTrajectory.realized)} <span className="text-muted">{b.trajectoryVs}</span> {fmt(vsTrajectory.expectedToDate)}{" "}
            <span
              className={
                vsTrajectory.status === "behind" ? "text-danger" : vsTrajectory.status === "ahead" ? "text-success" : "text-accent-strong"
              }
            >
              ({vsTrajectory.gapPercent !== null ? `${vsTrajectory.gapPercent > 0 ? "+" : ""}${vsTrajectory.gapPercent} %` : "—"})
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            {b.trajectoryStatus[vsTrajectory.status]} ·{" "}
            {b.trajectoryHint
              .replace("{elapsed}", String(Math.round(trajectory.elapsedRatio * 100)))
              .replace("{start}", trajWindow.startDate ?? "")
              .replace("{target}", trajWindow.targetDate ?? "")}
          </p>
        </div>
      )}
      <div className="border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            {b.expectedLabel}
            <input
              value={expectedInput}
              onChange={(e) => setExpectedInput(e.target.value)}
              placeholder="0"
              className="border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
            {Number.isFinite(Number(expectedInput)) && expectedInput.trim() !== "" && (
              <span className="font-mono text-[11px] text-muted">= {new Intl.NumberFormat("fr-FR").format(Number(expectedInput))}</span>
            )}
            <span className="text-[11px]">{expectation?.source === "business_case" ? b.expectedFromBusinessCase : b.expectedManualHint}</span>
          </label>
          {expectedUnsaved && (
            <span role="status" className="shrink-0 self-center border border-danger/50 px-2 py-0.5 text-xs font-medium text-danger">
              {b.unsaved}
            </span>
          )}
          <button type="button" onClick={() => void saveExpected()} className="shrink-0 bg-accent px-3 py-2 text-xs font-medium text-accent-ink">
            {b.saveExpected}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={b.expectedLabel} value={comparison.expectedAnnual} />
          <Stat label={b.observedLabel} value={comparison.observedAnnual} />
          <Stat label={b.gapLabel} value={comparison.gap} tone={comparison.gap !== null && comparison.gap < 0 ? "danger" : "success"} />
          <Stat label={b.percentLabel} value={comparison.percentOfExpected} suffix="%" />
        </div>
      </div>

      <div className="border border-border bg-surface p-4">
        <h3 className="font-display text-sm text-ink">{b.itemsTitle}</h3>
        <p className="mt-1 text-xs text-muted">{b.itemsHint}</p>
        <div className="mt-3 flex flex-col gap-2">
          {itemsResult.totalByPerimeter.length === 0 && <p className="text-xs text-muted">{b.noItems}</p>}
          {itemsResult.totalByPerimeter.map((p) => (
            <div key={p.perimeter} className="flex items-center justify-between border-l-2 border-accent bg-accent/5 px-3 py-2 text-xs">
              <span className="text-ink">
                {p.perimeter}
                {p.itemCount > 1 && <span className="text-muted"> ({p.itemCount} gains, max retenu)</span>}
              </span>
              <span className="font-semibold tabular-nums text-ink">{p.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{itemsResult.itemsTotal}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            value={newItem.label}
            onChange={(e) => setNewItem((v) => ({ ...v, label: e.target.value }))}
            placeholder={b.labelPlaceholder}
            aria-label={b.labelPlaceholder}
            className="min-w-[8rem] flex-[2] border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <input
            value={newItem.perimeter}
            onChange={(e) => setNewItem((v) => ({ ...v, perimeter: e.target.value }))}
            placeholder={b.perimeterPlaceholder}
            aria-label={b.perimeterPlaceholder}
            className="min-w-[8rem] flex-1 border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <input
            value={newItem.value}
            onChange={(e) => setNewItem((v) => ({ ...v, value: e.target.value }))}
            placeholder={b.valuePlaceholder}
            aria-label={b.valuePlaceholder}
            className="w-24 border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <button type="button" onClick={() => void addItem()} className="shrink-0 bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink">
            {b.addItem}
          </button>
        </div>
      </div>

      <div className="border border-border bg-surface p-4">
        <h3 className="font-display text-sm text-ink">{b.observationsTitle}</h3>
        <div className="mt-3 flex flex-col gap-2">
          {observations.length === 0 && <p className="text-xs text-muted">{b.noObservations}</p>}
          {observations.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-l-2 border-success bg-success/5 px-3 py-2 text-xs">
              <span className="text-ink">{o.month}</span>
              <span className="font-semibold tabular-nums text-ink">{o.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            value={newObs.month}
            onChange={(e) => setNewObs((v) => ({ ...v, month: e.target.value }))}
            placeholder={b.monthPlaceholder}
            aria-label={b.monthPlaceholder}
            className="w-28 border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <input
            value={newObs.value}
            onChange={(e) => setNewObs((v) => ({ ...v, value: e.target.value }))}
            placeholder={b.valuePlaceholder}
            aria-label={b.valuePlaceholder}
            className="w-24 border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <button type="button" onClick={() => void addObservation()} className="shrink-0 bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink">
            {b.addObservation}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, tone }: { label: string; value: number | null; suffix?: string; tone?: "danger" | "success" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className={`font-display text-2xl tabular-nums ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-ink"}`}>
        {value !== null ? `${value}${suffix ?? ""}` : "—"}
      </span>
    </div>
  );
}
