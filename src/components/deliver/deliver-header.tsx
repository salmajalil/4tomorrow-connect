import { Eyebrow } from "@/components/eyebrow";

export type MissionPhase = "DISCOVERY" | "EXECUTION" | "COMPLETE";

// Fixed, literal labels reproduced from the reference product — see
// src/lib/deliver.ts's DELIVERABLE_LABELS comment for why these stay
// exactly as given rather than being translated or domain-adapted.
export function DeliverHeader({
  projectTitle,
  organization,
  industry,
  phase,
}: {
  projectTitle: string;
  organization: string;
  industry: string;
  phase: MissionPhase;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>DELIVER · CONTROL CENTER</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">{projectTitle}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">DELIVER · COCKPIT</span>
        <span className="font-semibold text-ink">{projectTitle}</span>
        {(organization || industry) && (
          <span className="text-sm text-muted">
            {organization}
            {organization && industry ? " · " : ""}
            {industry}
          </span>
        )}
        <span className="ml-auto rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
          {phase}
        </span>
      </div>
    </div>
  );
}
