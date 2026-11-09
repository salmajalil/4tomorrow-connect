import Link from "next/link";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { CeoValidationPanel } from "@/components/impact/ceo-validation-panel";
import { MODULE_COLORS } from "@/lib/module-colors";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { ImpactIndicator, ImpactModule, ProjectImpact } from "@/lib/project-impact";
import { buildExecutiveSnapshot, type BriefingEvent, type ExecutiveSnapshot } from "@/lib/impact-briefing-calc";
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

function SummaryCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "success" | "danger" | "accent" | "urgent";
  children: React.ReactNode;
}) {
  const border = {
    success: "border-t-success",
    danger: "border-t-accent",
    accent: "border-t-accent-strong",
    urgent: "border-t-danger",
  }[tone];
  return (
    <div className={`flex min-w-0 flex-col border border-t-4 border-border bg-surface p-5 ${border}`}>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{title}</h2>
      <div className="mt-3 flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

// Top block, always visible: the four short sections the founder asked for
// — achievements, risks, opportunities, urgent hot spots. Every entry comes
// from buildExecutiveSnapshot (src/lib/impact-briefing-calc.ts), a pure
// function over rows already entered; nothing here is AI-written.
function ExecutiveSummary({ snap, t, language }: { snap: ExecutiveSnapshot; t: Dictionary; language: Language }) {
  const im = t.impact;
  const zoneLabel = (zone: string | null) => (zone ? im.riskZones[zone as keyof typeof im.riskZones] : im.notEvaluated);
  return (
    <section className="mt-8" aria-labelledby="executive-summary">
      <h2 id="executive-summary" className="sr-only">
        {im.summaryTitle}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={im.achievementsTitle} tone="success">
          {snap.achievements.length === 0 ? (
            <p className="text-muted">{im.achievementsEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {snap.achievements.slice(0, 5).map((a) => (
                <li key={`${a.kind}-${a.label}-${a.date}`} className="border-l-2 border-success pl-2">
                  <span className="text-ink">{a.label}</span>
                  <span className="block text-xs text-muted">
                    {a.kind === "phase" ? im.achievementPhase : im.achievementAction} · {formatDate(a.date, language)}
                    {a.owner ? ` · ${a.owner}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {snap.undatedDoneActions > 0 && (
            <p className="text-xs text-muted">{im.undatedDone.replace("{n}", String(snap.undatedDoneActions))}</p>
          )}
        </SummaryCard>

        <SummaryCard title={im.risksTitle} tone="danger">
          {snap.risks.length === 0 ? (
            <p className="text-muted">{snap.riskCount > 0 ? im.risksOnlyCritical : im.noRisks}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {snap.risks.map((r) => (
                <li key={r.name} className="border-l-2 border-accent pl-2">
                  <span className="text-ink">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {r.severity !== null ? `${zoneLabel(r.zone)} · ${r.severity}/25` : im.notEvaluated}
                    {r.impactedObject ? ` · ${im.impacts} ${r.impactedObject}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {snap.riskCount > snap.risks.length && (
            <p className="text-xs text-muted">{im.totalCount.replace("{n}", String(snap.riskCount))}</p>
          )}
        </SummaryCard>

        <SummaryCard title={im.opportunitiesTitle} tone="accent">
          {snap.opportunities.length === 0 ? (
            <p className="text-muted">{im.opportunitiesEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {snap.opportunities.map((o) => (
                <li key={o.name} className="border-l-2 border-success pl-2">
                  <span className="text-ink">{o.name}</span>
                  {o.reason && <span className="block line-clamp-2 text-xs text-muted">{o.reason}</span>}
                </li>
              ))}
            </ul>
          )}
          {snap.opportunityCount > snap.opportunities.length && (
            <p className="text-xs text-muted">{im.totalCount.replace("{n}", String(snap.opportunityCount))}</p>
          )}
        </SummaryCard>

        <SummaryCard title={im.urgentTitle} tone="urgent">
          {snap.hotSpots.length === 0 ? (
            <p className="text-muted">{im.urgentEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {snap.hotSpots.slice(0, 6).map((h) => (
                <li key={`${h.kind}-${h.label}`} className="border border-danger/40 bg-danger/5 p-2">
                  <span className="font-semibold text-ink">{h.label}</span>
                  <span className="block text-xs text-danger">
                    {h.kind === "critical_risk"
                      ? `${im.criticalRisk} · ${h.severity}/25${h.impactedObject ? ` · ${im.impacts} ${h.impactedObject}` : ""}`
                      : `${im.overdueAction} · ${im.daysLate.replace("{n}", String(h.daysLate))}`}
                    {h.owner ? ` · ${h.owner}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SummaryCard>
      </div>
    </section>
  );
}

function briefingLabel(e: BriefingEvent, t: Dictionary): string {
  if (e.kind === "ceo_response") {
    return t.impact.ceoValidation.outcome[e.label as keyof typeof t.impact.ceoValidation.outcome] ?? e.label;
  }
  return e.label;
}

// "Briefing équipe": no activity log table exists, so this list is rebuilt
// from the dates already stored on each row (action completion, phase
// start/end, risk/opportunity creation, CEO answer, scenario choice).
function TeamBriefing({ events, t, language }: { events: BriefingEvent[]; t: Dictionary; language: Language }) {
  const im = t.impact;
  return (
    <section className="mt-4 border border-border bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-ink">{im.briefingTitle}</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{im.briefingHint}</span>
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{im.briefingEmpty}</p>
      ) : (
        <ol className="mt-3 flex flex-col">
          {events.map((e, i) => (
            <li key={`${e.kind}-${e.label}-${e.date}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-border py-2 text-sm first:border-t-0">
              <span className="w-24 shrink-0 font-mono text-[11px] text-muted">{formatDate(e.date, language)}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-strong">{im.briefingKinds[e.kind]}</span>
              <span className="min-w-0 flex-1 text-ink">
                {briefingLabel(e, t)}
                {e.detail && <span className="text-muted"> · {e.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ImpactView({ project, t, language }: { project: ProjectImpact; t: Dictionary; language: Language }) {
  const im = t.impact;
  const snapshot = buildExecutiveSnapshot({ ...project.snapshotInput, today: new Date().toISOString().slice(0, 10) });
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

      {/* 1. Executive summary — always visible */}
      <ExecutiveSummary snap={snapshot} t={t} language={language} />

      {/* 2. Team briefing */}
      <TeamBriefing events={snapshot.teamBriefing} t={t} language={language} />

      {/* 3. Detailed report */}
      <div className="mt-14 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.26em] text-muted">
        <span className="h-px w-12 bg-accent" />
        {im.detailedTitle}
      </div>

      {/* Key indicators */}
      {project.keyIndicators.length > 0 && (
        <section className="mt-6">
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

      {/* AI narrative (Livrer's Executive Report): each observation is shown
          with the solution the prompt is required to pair with it. */}
      {project.executiveReport && (
        <section className="mt-4 border border-border bg-surface p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.recommendationsTitle}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">{project.executiveReport.summary}</p>
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {project.executiveReport.keyPoints.map((k, i) => (
              <li key={i} className="border border-border bg-surface-2 p-3 text-sm">
                <p className="text-ink">{k.observation}</p>
                {k.solution && (
                  <p className="mt-1.5 border-l-2 border-success pl-2 text-ink">
                    <span className="font-semibold text-success">{im.solutionLabel}</span> {k.solution}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.trajectory && <CeoValidationPanel transformationId={project.transformationId} />}

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
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{im.riskRegisterTitle}</h3>
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

      {/* Gabarit: every tool screen ends with a collapsed "how is this
          calculated" — this page had none before. Short on purpose: it
          names the source of each figure, it doesn't re-explain the figure
          itself. */}
      <details className="mt-10 border border-border bg-surface p-6 text-sm">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          {im.howCalculatedTitle}
        </summary>
        <ul className="mt-4 flex flex-col gap-2 text-muted">
          <li>{im.howCalculatedHeadline}</li>
          <li>{im.howCalculatedConfidence}</li>
          <li>{im.howCalculatedBenefit}</li>
          <li>{im.howCalculatedModules}</li>
          <li>{im.howCalculatedSummary}</li>
        </ul>
      </details>
    </div>
  );
}
