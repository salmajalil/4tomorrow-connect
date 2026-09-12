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

// A minimal ring instead of a text progress bar — reads at a glance,
// costs no vertical space next to the title.
function ProgressRing({ percent }: { percent: number }) {
  const size = 52;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-ink">
        {percent}%
      </span>
    </div>
  );
}

function ModuleDots({ moduleStatus }: { moduleStatus: Record<ModuleName, ModuleStatusValue> }) {
  const dotStyles: Record<ModuleStatusValue, string> = {
    not_started: "bg-border",
    in_progress: "bg-accent animate-pulse",
    done: "bg-success",
  };
  return (
    <div className="flex items-center gap-2">
      {MODULE_ORDER.map((m) => (
        <span key={m} title={`${MODULE_LABELS[m]} — ${STATUS_LABELS[moduleStatus[m]]}`} className="flex flex-col items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[moduleStatus[m]]}`} />
          <span className="text-[9px] uppercase tracking-wide text-muted">{MODULE_LABELS[m].slice(0, 3)}</span>
        </span>
      ))}
    </div>
  );
}

function BadgeButton({
  icon,
  count,
  active,
  onClick,
  tone,
}: {
  icon: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: "hot" | "win";
}) {
  const toneStyles =
    tone === "hot"
      ? active
        ? "border-danger bg-danger/15 text-danger"
        : "border-danger/30 bg-danger/5 text-danger"
      : active
        ? "border-success bg-success/15 text-success"
        : "border-success/30 bg-success/5 text-success";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-30 ${toneStyles}`}
    >
      <span aria-hidden>{icon}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function formatTargetDate(iso: string | null): string {
  if (!iso) return "à définir";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

type Panel = "hot" | "win" | "recs" | null;

function ProjectCard({ project }: { project: ControlTowerProject }) {
  const [panel, setPanel] = useState<Panel>(null);
  const domains = project.domains as Domain[];
  const relevantRecs = project.moduleRecommendations.filter((r) => r.relevance !== "not_relevant");
  const hotCount = project.risks.length + project.pendingValidationCount;
  const winCount = project.opportunities.length + project.keyMetrics.length;
  const doneCount = MODULE_ORDER.filter((m) => project.moduleStatus[m] === "done").length;

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next));
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-ink">{project.title}</p>
          <p className="mt-0.5 text-xs text-muted">{project.organizationName}</p>
          {domains.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <span key={d} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                  {DOMAIN_LABELS[d] ?? d}
                </span>
              ))}
            </div>
          )}
        </div>
        <ProgressRing percent={project.progressPercent} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModuleDots moduleStatus={project.moduleStatus} />
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden>📅</span>
          Cible : {formatTargetDate(project.targetDate)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BadgeButton icon="🔥" count={hotCount} active={panel === "hot"} onClick={() => toggle("hot")} tone="hot" />
        <BadgeButton icon="🏆" count={winCount} active={panel === "win"} onClick={() => toggle("win")} tone="win" />
        {relevantRecs.length > 0 && (
          <button
            type="button"
            onClick={() => toggle("recs")}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              panel === "recs" ? "border-accent bg-accent/15 text-accent-strong" : "border-accent/30 bg-accent/5 text-accent-strong"
            }`}
          >
            → {relevantRecs.length} module{relevantRecs.length > 1 ? "s" : ""} recommandé{relevantRecs.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {panel === "hot" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {project.pendingValidationCount > 0 && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-ink">
              ⚠ {project.pendingValidationCount} donnée{project.pendingValidationCount > 1 ? "s" : ""} financière
              {project.pendingValidationCount > 1 ? "s" : ""} en attente de validation
            </p>
          )}
          {project.risks.map((r) => (
            <div key={r.id} className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs">
              <span className="font-medium text-ink">{r.name}</span>
              {r.reason && <span className="text-muted"> — {r.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {panel === "win" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted">{doneCount}/{MODULE_ORDER.length} modules terminés</p>
          {project.keyMetrics.map((m) => (
            <div key={m.key} className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
              <span className="text-muted">{m.key}</span>
              <span className="font-semibold text-ink">{String(m.value)}</span>
            </div>
          ))}
          {project.opportunities.map((o) => (
            <div key={o.id} className="rounded-lg border border-success/30 bg-success/5 p-2.5 text-xs">
              <span className="font-medium text-ink">{o.name}</span>
              {o.reason && <span className="text-muted"> — {o.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {panel === "recs" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
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

  const totalHot = projects.reduce((n, p) => n + p.risks.length + p.pendingValidationCount, 0);
  const totalWin = projects.reduce((n, p) => n + p.opportunities.length + p.keyMetrics.length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Tour de contrôle</Eyebrow>
          <h1 className="mt-3 font-display text-3xl text-ink">Vue d&apos;ensemble de tes projets</h1>
        </div>
        <LivePulse lastSync={lastSync} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatTile label="Projets" value={projects.length} />
        <StatTile label="Points chauds" value={totalHot} tone={totalHot > 0 ? "danger" : undefined} />
        <StatTile label="Achievements" value={totalWin} />
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
        <div className="mt-8 flex flex-col gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.transformationId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
