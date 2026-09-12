"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchControlTowerProjects, MODULE_ORDER, type ControlTowerProject } from "@/lib/control-tower";
import { Eyebrow } from "@/components/eyebrow";
import { DOMAIN_LABELS, type Domain } from "@/lib/decide";
import type { ModuleName, ModuleStatusValue, RecommendableModule } from "@/types/database";

const MODULE_LABELS: Record<ModuleName, string> = {
  decide: "Decide",
  connect: "Connect",
  learn: "Learn",
  deliver: "Deliver",
};

const MODULE_HREF: Partial<Record<ModuleName, string>> = {
  decide: "/decide",
  connect: "/connect",
};

const STATUS_LABELS: Record<ModuleStatusValue, string> = {
  not_started: "Non démarré",
  in_progress: "En cours",
  done: "Terminé",
};

function LivePulse({ lastSync }: { lastSync: Date | null }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-live">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      {lastSync ? `Synchronisé à ${lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "En direct"}
    </span>
  );
}

function ModulePill({ module, status }: { module: ModuleName; status: ModuleStatusValue }) {
  const styles: Record<ModuleStatusValue, string> = {
    not_started: "border-border text-muted",
    in_progress: "border-accent/50 bg-accent/10 text-accent-strong",
    done: "border-success/50 bg-success/10 text-success",
  };
  return (
    <span
      title={`${MODULE_LABELS[module]} — ${STATUS_LABELS[status]}`}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      {status === "in_progress" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {status === "done" && <span aria-hidden>✓</span>}
      {MODULE_LABELS[module]}
    </span>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "live" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      <span
        className={`font-display text-3xl tabular-nums ${
          tone === "danger" ? "text-danger" : tone === "live" ? "text-live" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ProjectCard({ project, expanded, onToggle }: { project: ControlTowerProject; expanded: boolean; onToggle: () => void }) {
  const domains = project.domains as Domain[];
  const relevantRecs = project.moduleRecommendations.filter((r) => r.relevance !== "not_relevant");

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-5 transition ${
        expanded ? "border-accent bg-accent/5 shadow-[0_0_0_1px_var(--accent)]" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-ink">{project.title}</p>
          <p className="mt-0.5 text-xs text-muted">{project.organizationName}</p>
        </div>
        {project.pendingValidationCount > 0 && (
          <span
            title="Données financières en attente de validation"
            className="shrink-0 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger"
          >
            ⚠ {project.pendingValidationCount} à valider
          </span>
        )}
      </div>

      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <span key={d} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
              {DOMAIN_LABELS[d] ?? d}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {MODULE_ORDER.map((m) => (
          <ModulePill key={m} module={m} status={project.moduleStatus[m]} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-surface-2 py-2">
          <p className="font-semibold text-ink">{project.priorities.length}</p>
          <p className="text-muted">Priorités</p>
        </div>
        <div className="rounded-lg bg-surface-2 py-2">
          <p className="font-semibold text-danger">{project.risks.length}</p>
          <p className="text-muted">Risques</p>
        </div>
        <div className="rounded-lg bg-surface-2 py-2">
          <p className="font-semibold text-success">{project.opportunities.length}</p>
          <p className="text-muted">Opportunités</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="self-start text-xs font-semibold text-accent underline underline-offset-2"
      >
        {expanded ? "Réduire ▲" : "Voir le détail →"}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {project.keyMetrics.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Indicateurs clés validés
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {project.keyMetrics.map((m) => (
                  <div key={m.key} className="rounded-lg border border-success/30 bg-success/5 px-3 py-1.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{m.key}</p>
                    <p className="text-sm font-semibold text-ink">{String(m.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.priorities.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Priorités</h4>
              <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                {project.priorities.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface-2 p-2.5">
                    <span className="font-medium text-ink">{p.name}</span>
                    {p.reason && <span className="text-muted"> — {p.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(project.risks.length > 0 || project.opportunities.length > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {project.risks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Risques</h4>
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs">
                    {project.risks.map((r) => (
                      <li key={r.id} className="rounded-lg border border-danger/30 bg-danger/5 p-2.5">
                        <span className="font-medium text-ink">{r.name}</span>
                        {r.reason && <span className="text-muted"> — {r.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {project.opportunities.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Opportunités</h4>
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs">
                    {project.opportunities.map((o) => (
                      <li key={o.id} className="rounded-lg border border-success/30 bg-success/5 p-2.5">
                        <span className="font-medium text-ink">{o.name}</span>
                        {o.reason && <span className="text-muted"> — {o.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {relevantRecs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Modules recommandés</h4>
              <div className="mt-2 flex flex-col gap-2">
                {relevantRecs.map((r) => {
                  const href = MODULE_HREF[r.module as RecommendableModule];
                  return (
                    <div key={r.module} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-2.5 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium text-ink">{MODULE_LABELS[r.module]}</span>
                        {r.reason && <span className="text-muted"> — {r.reason}</span>}
                      </div>
                      {href ? (
                        <Link href={href} className="shrink-0 font-semibold text-accent underline underline-offset-2">
                          Ouvrir →
                        </Link>
                      ) : (
                        <span className="shrink-0 text-muted">Bientôt</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ControlTowerView({
  userId,
  initialProjects,
}: {
  userId: string;
  initialProjects: ControlTowerProject[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const next = await fetchControlTowerProjects(supabase, userId);
    setProjects(next);
    setLastSync(new Date());
  }, [userId]);

  // All these tables are already in the supabase_realtime publication
  // (migration 0002) and RLS-scoped, so subscribing without a per-row
  // filter is safe — Postgres only forwards changes this user's policies
  // already let them see. Any relevant change just re-fetches everything;
  // the dataset (one user's own projects) is small enough that a full
  // aggregate re-fetch is simpler and less bug-prone than patching state
  // per event type.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("control-tower")
      .on("postgres_changes", { event: "*", schema: "public", table: "module_status" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "module_recommendations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "risks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "opportunities" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "trajectories" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transformations" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const totalRisks = projects.reduce((n, p) => n + p.risks.length, 0);
  const totalOpportunities = projects.reduce((n, p) => n + p.opportunities.length, 0);
  const totalPending = projects.reduce((n, p) => n + p.pendingValidationCount, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Tour de contrôle</Eyebrow>
          <h1 className="mt-3 font-display text-3xl text-ink">Vue d&apos;ensemble de tes projets</h1>
        </div>
        <LivePulse lastSync={lastSync} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Projets" value={projects.length} />
        <StatTile label="Risques" value={totalRisks} tone={totalRisks > 0 ? "danger" : undefined} />
        <StatTile label="Opportunités" value={totalOpportunities} />
        <StatTile label="À valider" value={totalPending} tone={totalPending > 0 ? "danger" : undefined} />
      </div>

      <div className="mt-6">
        <Link
          href="/decide"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong"
        >
          + Nouveau diagnostic
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            Aucun projet pour l&apos;instant. Lance un diagnostic pour démarrer ta première transformation.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          {projects.map((p) => (
            <ProjectCard
              key={p.transformationId}
              project={p}
              expanded={expandedId === p.transformationId}
              onToggle={() => setExpandedId((id) => (id === p.transformationId ? null : p.transformationId))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
