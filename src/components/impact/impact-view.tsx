import Link from "next/link";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { MODULE_COLORS } from "@/lib/module-colors";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ImpactIndicator, ImpactModule, ProjectImpact } from "@/lib/project-impact";
import type { IndicatorConfidence, Language, ModuleName } from "@/types/database";

// The confidence level is a selling point, not a footnote: every figure on
// this page carries it, so a client always knows what is proven and what
// is still an estimate.
export function ConfidenceBadge({ confidence, t }: { confidence: IndicatorConfidence; t: Dictionary }) {
  const styles: Record<IndicatorConfidence, string> = {
    verified: "bg-success text-bg",
    estimate: "border border-accent text-accent-strong",
    unknown: "border border-dashed border-muted text-muted",
  };
  return (
    <span
      title={t.impact.confidenceHint[confidence]}
      className={`inline-flex shrink-0 items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${styles[confidence]}`}
    >
      {t.impact.confidence[confidence]}
    </span>
  );
}

function formatValue(value: ImpactIndicator["value"]): string {
  if (value === null || value === "") return "—";
  return String(value);
}

function formatDate(iso: string | null, language: Language): string | null {
  if (!iso) return null;
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function moduleLabel(module: ModuleName, t: Dictionary): string {
  return t.nav[module];
}

function moduleFacts(mod: ImpactModule, t: Dictionary): string[] {
  const c = t.impact.counts;
  if (mod.module === "decide") return [`${mod.counts.scenarios} ${c.scenarios}`, `${mod.counts.priorities} ${c.priorities}`];
  if (mod.module === "connect") return [`${mod.counts.matches} ${c.matches}`];
  if (mod.module === "learn") return [`${mod.counts.trainings} ${c.trainings}`];
  return [`${mod.counts.phasesDone} ${c.phasesDone} ${mod.counts.phases}`, `${mod.counts.deliverables} ${c.deliverables}`];
}

function moduleHref(module: ModuleName, transformationId: string): string {
  if (module === "decide") return `/decide?transformationId=${transformationId}`;
  if (module === "connect") return "/connect";
  if (module === "learn") return `/learn?transformationId=${transformationId}`;
  return `/deliver?transformationId=${transformationId}`;
}

function KeyIndicatorCard({ indicator, t }: { indicator: ImpactIndicator; t: Dictionary }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{indicator.label}</span>
        <ConfidenceBadge confidence={indicator.confidence} t={t} />
      </div>
      <span className="font-display text-5xl leading-none text-ink tabular-nums">{formatValue(indicator.value)}</span>
      <span className="text-sm leading-relaxed text-muted">{t.impact.confidenceHint[indicator.confidence]}</span>
    </div>
  );
}

export function ImpactView({ project, t, language }: { project: ProjectImpact; t: Dictionary; language: Language }) {
  const im = t.impact;
  const total = project.indicators.length || 1;
  const target = formatDate(project.targetDate, language);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <nav className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        <Link href="/control-tower" className="hover:text-ink">
          {im.backToTower}
        </Link>
        <span className="px-2">/</span>
        <span>{project.organizationName || t.common.untitledProject}</span>
      </nav>

      {/* Verdict */}
      <section className="mt-8 flex flex-wrap items-end justify-between gap-8">
        <div className="min-w-0 flex-[1_1_560px]">
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.26em] text-muted">
            <span className="h-px w-12 bg-accent" />
            {im.eyebrow}
          </div>
          {project.headline ? (
            <>
              <h1 className="mt-5 text-balance font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
                {project.headline.label} :{" "}
                <span className="italic text-accent">{formatValue(project.headline.value)}</span>
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                <ConfidenceBadge confidence={project.headline.confidence} t={t} />
                {project.trajectory && (
                  <span>
                    {im.scenarioRetained} : <span className="text-ink">{project.trajectory.name}</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-balance font-display text-5xl leading-[1.02] text-ink">{im.pendingHeadline}</h1>
              <p className="mt-4 max-w-xl text-muted">{im.pendingHint}</p>
              <Link
                href={`/decide?transformationId=${project.transformationId}`}
                className="mt-6 inline-block bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
              >
                {im.goToDecide}
              </Link>
            </>
          )}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{project.title}</p>
        </div>
        <div className="flex min-w-[220px] flex-col gap-3">
          <ExportPdfButton
            kind="project-ceo"
            payload={{ transformationId: project.transformationId }}
            filename="4tomorrow-synthese-ceo.pdf"
            label={im.ceoReport}
          />
          <ExportPdfButton
            kind="project-detailed"
            payload={{ transformationId: project.transformationId }}
            filename="4tomorrow-rapport-detaille.pdf"
            label={im.detailedReport}
          />
        </div>
      </section>

      {/* Key indicators */}
      {project.keyIndicators.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.keyIndicators}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {project.keyIndicators.map((indicator) => (
              <KeyIndicatorCard key={indicator.label} indicator={indicator} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Benefit + confidence */}
      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="border border-border bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{im.hoursToRoadmap}</p>
          {project.hoursToRoadmap !== null ? (
            <p className="mt-3 font-display text-5xl leading-none text-ink tabular-nums">
              {project.hoursToRoadmap} {im.hoursUnit}
            </p>
          ) : (
            <p className="mt-3 text-muted">{im.roadmapPending}</p>
          )}
          <p className="mt-3 text-sm text-muted">{im.benefitTitle}</p>
        </div>
        <div className="border border-border bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{im.nextMilestone}</p>
          {project.nextMilestone ? (
            <>
              <p className="mt-3 font-display text-3xl leading-tight text-ink">{project.nextMilestone.name}</p>
              <p className="mt-2 text-sm text-muted">{formatDate(project.nextMilestone.endDate, language)}</p>
            </>
          ) : (
            <p className="mt-3 text-muted">{im.noPhases}</p>
          )}
          {target && (
            <p className="mt-3 text-sm text-muted">
              {im.target} : <span className="text-ink">{target}</span>
            </p>
          )}
        </div>
        <div className="border border-border bg-surface p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{im.confidenceTitle}</p>
          <div className="mt-4 flex h-2.5 w-full overflow-hidden bg-border">
            <div className="bg-success" style={{ width: `${(project.confidence.verified / total) * 100}%` }} />
            <div className="bg-accent" style={{ width: `${(project.confidence.estimate / total) * 100}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              <span className="text-ink tabular-nums">{project.confidence.verified}</span> {im.confidenceCounts.verified}
            </span>
            <span>
              <span className="text-ink tabular-nums">{project.confidence.estimate}</span> {im.confidenceCounts.estimate}
            </span>
            <span>
              <span className="text-ink tabular-nums">{project.confidence.unknown}</span> {im.confidenceCounts.unknown}
            </span>
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-4xl text-ink">
            {im.journeyTitle} <span className="italic text-accent">{im.journeyAccent}</span>
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{im.journeyHint}</span>
        </div>
        <div className="mt-6 grid grid-cols-1 border border-border sm:grid-cols-2 lg:grid-cols-4">
          {project.modules.map((mod) => {
            const color = MODULE_COLORS[mod.module].accent;
            const fill = mod.status === "done" ? 100 : mod.status === "in_progress" ? 50 : 0;
            return (
              <Link
                key={mod.module}
                href={moduleHref(mod.module, project.transformationId)}
                className="group flex flex-col gap-3 border-border bg-surface p-6 transition hover:bg-surface-2 lg:border-r lg:last:border-r-0"
              >
                <div className="-mx-6 -mt-6 mb-2 h-[3px] bg-border">
                  <div className="h-full" style={{ width: `${fill}%`, background: color }} />
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span style={{ color }}>{im.moduleSub[mod.module]}</span>
                  <span className="text-muted">{t.controlTower[mod.status === "done" ? "statusDone" : mod.status === "in_progress" ? "statusInProgress" : "statusNotStarted"]}</span>
                </div>
                <span className="font-display text-3xl text-ink">{moduleLabel(mod.module, t)}</span>
                <ul className="flex flex-col gap-1 text-sm text-muted">
                  {moduleFacts(mod, t).map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Hot spots + next steps */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="border border-border bg-surface p-6 lg:col-span-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.hotTitle}</h3>
          {project.risks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{im.noRisks}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {project.risks.slice(0, 5).map((risk) => (
                <li key={risk.name} className="border border-danger/40 bg-danger/5 p-3">
                  <p className="text-sm font-semibold text-ink">{risk.name}</p>
                  {risk.reason && <p className="mt-1 text-sm text-muted">{risk.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border border-border bg-surface p-6 lg:col-span-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.nextStepsTitle}</h3>
          {project.phases.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{im.noPhases}</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {project.phases.map((phase) => (
                <li key={`${phase.name}-${phase.startDate}`} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <span className="min-w-0 flex-[1_1_220px] text-sm text-ink">{phase.name}</span>
                  <span className="font-mono text-[11px] text-muted">{formatDate(phase.endDate, language)}</span>
                  <span
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                      phase.status === "done"
                        ? "bg-success text-bg"
                        : phase.status === "in_progress"
                          ? "bg-accent text-accent-ink"
                          : "border border-border text-muted"
                    }`}
                  >
                    {im.phaseStatus[phase.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {(project.opportunities.length > 0 || project.goodIdeas.length > 0) && (
        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {project.opportunities.length > 0 && (
            <div className="border border-border bg-surface p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.opportunitiesTitle}</h3>
              <ul className="mt-4 flex flex-col gap-2">
                {project.opportunities.slice(0, 5).map((o) => (
                  <li key={o.name} className="border border-success/40 bg-success/5 p-3">
                    <p className="text-sm font-semibold text-ink">{o.name}</p>
                    {o.reason && <p className="mt-1 text-sm text-muted">{o.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {project.goodIdeas.length > 0 && (
            <div className="border border-border bg-surface p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.goodIdeasTitle}</h3>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-ink">
                {project.goodIdeas.slice(0, 6).map((idea) => (
                  <li key={idea} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                    {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
