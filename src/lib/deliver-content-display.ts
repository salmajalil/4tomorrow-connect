// Pure helpers behind the Livrer KPI dashboard and risk map visuals
// (src/components/deliver/deliverables-tab.tsx). Both take AI-authored free
// text or categorical labels and re-encode them visually — neither invents
// a value: leadingNumber only extracts a number already present in text the
// AI wrote, and riskCellTone is a deterministic lookup from the two
// categorical labels the AI already chose.

export function leadingNumber(s: string): number | null {
  const m = s.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type Severity = "low" | "medium" | "high";
const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

/** Qualitative likelihood × impact → severity tone, same tiering spirit as the AR risk-matrix's 5×5 grid. */
export function riskCellTone(likelihood: Severity, impact: Severity): "good" | "warn" | "crit" {
  const score = SEVERITY_RANK[likelihood] * SEVERITY_RANK[impact];
  if (score >= 6) return "crit";
  if (score >= 3) return "warn";
  return "good";
}
