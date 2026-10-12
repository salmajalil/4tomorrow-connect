"use client";

import { useState } from "react";
import type { ScenarioOutput } from "@/lib/decide";
import type { IndicatorFeedback, TrajectoryIndicators } from "@/types/database";
import { ValidationQueue } from "@/components/decide/validation-queue";
import { RoadmapView } from "@/components/decide/roadmap-view";
import { useLanguage } from "@/components/language-provider";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type ScenarioWithId = ScenarioOutput & { trajectoryId: string };

const SLOT_LABELS = ["A", "B", "C"];

type DetailTab = "brief" | "techno" | "roadmap" | "suppliers";

function SourceBadge({ source, t }: { source: "registry" | "web_search"; t: Dictionary }) {
  // Only partners from the 4 Tomorrow network get a badge: it is a mark of
  // trust. Market research results need no label.
  if (source !== "registry") return null;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        source === "registry" ? "bg-success/15 text-success" : "bg-accent/15 text-accent-strong"
      }`}
    >
      {source === "registry" ? t.decide.scenarios.registrySource : t.decide.scenarios.webSource}
    </span>
  );
}

function TechStackRow({ item, t }: { item: ScenarioOutput["techStack"][number]; t: Dictionary }) {
  const maturityMatch = /(\d+)\s*\/?\s*(?:-|à|to)?\s*(\d+)?/.exec(item.maturity);
  const level = maturityMatch ? Number(maturityMatch[1]) : null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink">{item.name}</p>
        <span className="text-xs text-accent-strong">
          {item.maturityScale} — {item.maturity}
        </span>
      </div>
      {level !== null && (
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < level ? "bg-accent" : "bg-border"}`}
            />
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted">{item.detail}</p>
      <p className="mt-1 text-xs text-ink">{t.common.benefit} : {item.benefit}</p>
    </div>
  );
}

export function ScenarioCard({
  scenario,
  index,
  co2SliderLabel,
  selected,
  onSelect,
  detail = false,
  onOpenDetail,
  recommended = false,
  compact = false,
}: {
  scenario: ScenarioWithId;
  index: number;
  co2SliderLabel: string;
  selected: boolean;
  onSelect: () => void;
  // Compact mode (comparison list): summary only, "voir le détail" navigates
  // away instead of expanding inline — 3 cards each unfolding their own
  // tabs in place got cluttered fast. Detail mode (focused single-scenario
  // page): tabs always shown, no toggle needed.
  detail?: boolean;
  onOpenDetail?: () => void;
  // The scenario 4 Tomorrow recommends gets the full card; the two
  // alternatives are shown compact, one click away from comparison.
  recommended?: boolean;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const scenarios = t.decide.scenarios;
  const [activeTab, setActiveTab] = useState<DetailTab>("brief");
  const [indicators, setIndicators] = useState<TrajectoryIndicators>(scenario.indicators);
  const [feedback, setFeedback] = useState<IndicatorFeedback>({});
  const [expanded, setExpanded] = useState(false);

  const CATEGORY_LABELS: Record<string, string> = {
    technology: t.connect.results.categoryTechnology,
    startup: t.connect.results.categoryStartup,
    expert: t.connect.results.categoryExpert,
    partner: t.connect.results.categoryPartner,
    funding: t.connect.results.categoryFunding,
    supplier: t.connect.results.categorySupplier,
    support: t.connect.results.categorySupport,
  };

  const TABS: { id: DetailTab; label: string }[] = [
    { id: "brief", label: scenarios.tabBrief },
    { id: "techno", label: scenarios.tabTechno },
    { id: "roadmap", label: scenarios.tabRoadmap },
    { id: "suppliers", label: scenarios.tabSuppliers },
  ];

  const rank: Record<string, number> = { verified: 0, estimate: 1, unknown: 2 };
  const keyFigures = Object.entries(indicators)
    .filter(([, e]) => e.value !== null && e.value !== "")
    .sort((x, y) => rank[x[1].confidence] - rank[y[1].confidence])
    .slice(0, compact ? 1 : 3);
  const stanceShort = scenarios.stanceShort[index] ?? scenario.stance;

  return (
    <div
      className={`flex flex-col gap-5 border p-5 transition sm:p-6 ${
        selected || recommended ? "border-accent bg-surface" : "border-border bg-surface"
      } ${recommended && !compact ? "shadow-[0_0_0_1px_var(--accent)]" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]">
        <span className="text-muted">
          {SLOT_LABELS[index] ?? index + 1} · {stanceShort}
        </span>
        {recommended && <span className="bg-accent px-2 py-0.5 text-accent-ink">{scenarios.recommended}</span>}
        {selected && !recommended && <span className="border border-accent px-2 py-0.5 text-accent-strong">{scenarios.chosen}</span>}
      </div>

      <div>
        <h3 className={`text-balance font-display leading-tight text-ink ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
          {scenario.name}
        </h3>
        {keyFigures[0] && (
          <p className="mt-2 text-base text-body">
            {keyFigures[0][0]} : <span className="font-medium text-accent-strong">{String(keyFigures[0][1].value)}</span>
          </p>
        )}
      </div>

      <div>
        <p className={`text-sm leading-relaxed text-muted ${expanded ? "" : compact ? "line-clamp-2" : "line-clamp-3"}`}>
          {scenario.description}
        </p>
        {!compact && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            {expanded ? scenarios.readLess : scenarios.readMore}
          </button>
        )}
      </div>

      {!compact && keyFigures.length > 0 && (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{scenarios.keyFigures}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {keyFigures.map(([key, entry]) => (
              <div key={key} className="flex min-w-0 flex-col gap-2 border border-border bg-surface-2 p-3">
                <span className="text-xs leading-snug text-muted">{key}</span>
                <span className="font-display text-2xl leading-none text-ink">{String(entry.value)}</span>
                <span
                  className={`self-start px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                    entry.confidence === "verified"
                      ? "bg-success text-bg"
                      : entry.confidence === "estimate"
                        ? "border border-accent/70 text-accent-strong"
                        : "border border-dashed border-muted text-muted"
                  }`}
                >
                  {entry.confidence === "verified"
                    ? scenarios.verifiedBadge
                    : entry.confidence === "estimate"
                      ? scenarios.estimateBadge
                      : scenarios.unknownBadge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <ValidationQueue
          trajectoryId={scenario.trajectoryId}
          indicators={indicators}
          feedback={feedback}
          onChange={({ indicators: i, feedback: f }) => {
            setIndicators(i);
            setFeedback(f);
          }}
          t={t}
        />
      )}

      {!compact && (scenario.risksSpecific.length > 0 || scenario.opportunitiesSpecific.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-success">{scenarios.gains}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {scenario.opportunitiesSpecific.map((o, i) => (
                <li key={`opp-${i}`} title={o.reason} className="flex gap-2 text-sm text-body">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  {o.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-danger">{scenarios.watch}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {scenario.risksSpecific.map((r, i) => (
                <li key={`risk-${i}`} title={r.reason} className="flex gap-2 text-sm text-body">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  {r.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!detail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="self-start text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          {compact ? scenarios.seeDetail : scenarios.seeFullDetail}
        </button>
      )}

      {detail && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-accent text-accent-ink"
                    : "border border-border text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "brief" && (
            <div className="flex flex-col gap-4">
              <div className="border border-border bg-surface-2 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{scenarios.positioning}</h4>
                <p className="mt-1 text-sm text-body">{scenario.stance}</p>
              </div>
              <div className="border border-border bg-surface-2 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{scenarios.executiveBriefing}</h4>
                <p className="mt-1 text-sm text-ink">{scenario.executiveBriefing}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{scenarios.scenarioRisks}</h4>
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
                    {scenario.risksSpecific.map((r, i) => (
                      <li key={i}>
                        <span className="font-medium text-ink">{r.name}</span> — {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {scenarios.scenarioOpportunities}
                  </h4>
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted">
                    {scenario.opportunitiesSpecific.map((o, i) => (
                      <li key={i}>
                        <span className="font-medium text-ink">{o.name}</span> — {o.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "techno" && (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{scenarios.stackSolutions}</h4>
                <div className="mt-2 flex flex-col gap-2">
                  {scenario.techStack.map((item, i) => (
                    <TechStackRow key={i} item={item} t={t} />
                  ))}
                </div>
              </div>
              {scenario.regulations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {scenarios.applicableRegulations}
                  </h4>
                  <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted">
                    {scenario.regulations.map((r, i) => (
                      <li key={i}>
                        <span className="font-medium text-ink">{r.name}</span> — {r.description}
                        {r.sourceUrl && (
                          <>
                            {" "}
                            <a
                              href={r.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent underline underline-offset-2"
                            >
                              {scenarios.source}
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "roadmap" && (
            <RoadmapView trajectoryId={scenario.trajectoryId} co2SliderLabel={co2SliderLabel} />
          )}

          {activeTab === "suppliers" &&
            (scenario.suppliers.length > 0 ? (
              <div className="flex flex-col gap-2">
                {scenario.suppliers.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-ink">
                        {s.name}{" "}
                        <span className="text-xs font-normal text-muted">
                          ({CATEGORY_LABELS[s.category] ?? s.category})
                        </span>
                      </p>
                      <SourceBadge source={s.source} t={t} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{s.reason}</p>
                    {(s.website || s.contactEmail) && (
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        {s.website && (
                          <a
                            href={s.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-accent underline underline-offset-2"
                          >
                            {scenarios.site}
                          </a>
                        )}
                        {s.contactEmail && (
                          <a
                            href={`mailto:${s.contactEmail}`}
                            className="font-medium text-accent underline underline-offset-2"
                          >
                            {s.contactEmail}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">{scenarios.noSuppliers}</p>
            ))}
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        className={`self-start rounded-lg px-5 py-2 text-sm font-semibold transition ${
          selected
            ? "bg-accent text-accent-ink"
            : "border border-accent text-accent hover:bg-accent hover:text-accent-ink"
        }`}
      >
        {selected ? scenarios.chosen : scenarios.chooseThis}
      </button>
    </div>
  );
}
