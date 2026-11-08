"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchControlTowerProjects, MODULE_ORDER, type ControlTowerProject } from "@/lib/control-tower";
import { Eyebrow } from "@/components/eyebrow";
import { ExportPdfButton } from "@/components/export-pdf-button";
import { DOMAIN_LABELS, type Domain } from "@/lib/decide";
import { useLanguage } from "@/components/language-provider";
import { TrophyIcon, CalendarIcon, AlertIcon, ArrowRightIcon, SearchIcon, Icon, type IconName } from "@/components/icons";
import { MODULE_COLORS } from "@/lib/module-colors";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type {
  ActionStatus,
  ModuleName,
  ModuleStatusValue,
  TransformationMember,
  TransformationMemberRole,
} from "@/types/database";
import { computeRiskSeverity } from "@/lib/risk-scoring";
import { RiskMatrix } from "@/components/control-tower/risk-matrix";

function moduleHref(module: ModuleName, transformationId: string): string | null {
  if (module === "decide") return "/decide";
  if (module === "connect") return "/connect";
  if (module === "learn") return `/learn?transformationId=${transformationId}`;
  if (module === "deliver") return `/deliver?transformationId=${transformationId}`;
  return null;
}

function LivePulse({ lastSync, t }: { lastSync: Date | null; t: Dictionary }) {
  const language = useLanguage().language;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-live">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      {lastSync
        ? `${t.controlTower.syncedAt} ${lastSync.toLocaleTimeString(language === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}`
        : t.controlTower.live}
    </span>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: "danger" | "live" | "accent" }) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-surface p-4">
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{label}</span>
      <span
        className={`font-display text-4xl leading-none tabular-nums ${
          tone === "danger" ? "text-danger" : tone === "live" ? "text-live" : tone === "accent" ? "text-accent-strong" : "text-ink"
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

// The four modules as a connected path: a segment per module, filled when
// done, half-lit while in progress — the same visual as the module strip.
function ModulePath({
  moduleStatus,
  moduleLabels,
  statusLabels,
}: {
  moduleStatus: Record<ModuleName, ModuleStatusValue>;
  moduleLabels: Record<ModuleName, string>;
  statusLabels: Record<ModuleStatusValue, string>;
}) {
  return (
    <ol className="grid grid-cols-4 gap-1.5">
      {MODULE_ORDER.map((m) => {
        const st = moduleStatus[m];
        const color = MODULE_COLORS[m].accent;
        return (
          <li key={m} title={`${moduleLabels[m]} — ${statusLabels[st]}`} className="flex flex-col gap-1.5">
            <span
              className="h-1.5"
              style={{
                background: st === "done" ? color : st === "in_progress" ? `color-mix(in srgb, ${color} 45%, transparent)` : "var(--border)",
              }}
            />
            <span className={`flex items-center gap-1 text-xs ${st === "not_started" ? "text-muted" : "text-body"}`}>
              <Icon name={m} className="h-3 w-3 shrink-0" style={{ color: st === "not_started" ? undefined : color }} />
              <span className="truncate">{moduleLabels[m]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function formatTargetDate(iso: string | null, t: Dictionary, language: "fr" | "en"): string {
  if (!iso) return t.controlTower.toBeDefined;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "Organisation · Domain" — a name you can scan in a list, instead of the
// first 72 characters of the challenge statement.
function shortName(project: ControlTowerProject, t: Dictionary): string {
  const domains = project.domains as Domain[];
  const first = domains[0] ? (DOMAIN_LABELS[domains[0]] ?? domains[0]).split(/ [&/] /)[0] : "";
  const extra = domains.length > 1 ? ` +${domains.length - 1}` : "";
  const org = project.organizationName || t.common.untitledProject;
  return first ? `${org} · ${first}${extra}` : org;
}

function nextModule(project: ControlTowerProject): ModuleName | null {
  return MODULE_ORDER.find((m) => project.moduleStatus[m] !== "done") ?? null;
}

type Panel = "risks" | "confirm" | "win" | "recs" | "team" | "actions" | null;

// PROJET ET ÉQUIPE — a member list + invite form, added inside the existing
// expandable-panel pattern (same mechanism as risks/confirm/win/recs) so no
// new nav entry or route is needed for the team workspace the brief asks
// for. No real email is sent (no mailer exists in this codebase) — the UI
// says so plainly instead of pretending one went out.
function TeamPanel({
  transformationId,
  members,
  t,
  onInvited,
  onRemoved,
}: {
  transformationId: string;
  members: TransformationMember[];
  t: Dictionary;
  onInvited: (member: TransformationMember) => void;
  onRemoved: (memberId: string) => void;
}) {
  const ct = t.controlTower;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TransformationMemberRole>("expert");
  const [domain, setDomain] = useState<ModuleName>("decide");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabels: Record<TransformationMemberRole, string> = {
    consultant: ct.teamRoleConsultant,
    client: ct.teamRoleClient,
    expert: ct.teamRoleExpert,
    ceo: ct.teamRoleCeo,
  };
  const moduleLabels: Record<ModuleName, string> = {
    decide: t.nav.decide,
    connect: t.nav.connect,
    learn: t.nav.learn,
    deliver: t.nav.deliver,
  };

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/control-tower/invite-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformationId, email, role, domain: role === "expert" ? domain : undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || ct.teamInviteError);
        return;
      }
      onInvited({
        id: body.id,
        transformation_id: transformationId,
        user_id: null,
        invited_email: email,
        role,
        domain: role === "expert" ? domain : null,
        invited_at: new Date().toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      });
      setEmail("");
    } catch {
      setError(ct.teamInviteError);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember(memberId: string) {
    onRemoved(memberId); // optimistic — small list, low risk, matches toggleArchive's existing pattern
    await fetch(`/api/control-tower/invite-member?id=${memberId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      {members.length === 0 ? (
        <p className="text-xs text-muted">{ct.teamEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 border border-border bg-surface-2 px-3 py-2 text-xs">
              <div className="min-w-0">
                <span className="font-medium text-ink">{m.invited_email}</span>
                <span className="text-muted">
                  {" · "}
                  {roleLabels[m.role]}
                  {m.domain ? ` (${moduleLabels[m.domain]})` : ""}
                  {" · "}
                  {m.accepted_at ? ct.teamStatusAccepted : ct.teamStatusPending}
                </span>
              </div>
              <button type="button" onClick={() => removeMember(m.id)} className="shrink-0 text-muted hover:text-danger">
                {ct.teamRemove}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submitInvite} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <label className="text-xs text-muted">{ct.teamInvite}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={ct.teamInviteEmailPlaceholder}
            className="border border-border bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{ct.teamInviteRoleLabel}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TransformationMemberRole)}
            className="border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            {(Object.keys(roleLabels) as TransformationMemberRole[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </div>
        {role === "expert" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">{ct.teamInviteDomainLabel}</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as ModuleName)}
              className="border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              {(Object.keys(moduleLabels) as ModuleName[]).map((m) => (
                <option key={m} value={m}>
                  {moduleLabels[m]}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          {submitting ? ct.teamInviteSubmitting : ct.teamInviteSubmit}
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">{ct.teamInviteNotice}</p>
    </div>
  );
}

const ACTION_STATUS_CYCLE: Record<ActionStatus, ActionStatus> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

type RiskRowData = {
  id: string;
  name: string;
  reason: string | null;
  probability: number | null;
  impact: number | null;
  owner: string | null;
  treatment: string | null;
};

// probability/impact/owner/treatment are set here by the user — never by
// the AI, which only ever supplied name/reason (see risks table comment,
// supabase/migrations/0012_actions_and_benefits.sql). Severity itself is
// computed, never stored (src/lib/risk-scoring.ts).
function RiskRow({ risk, ct }: { risk: RiskRowData; ct: Dictionary["controlTower"] }) {
  const [probability, setProbability] = useState(risk.probability);
  const [impact, setImpact] = useState(risk.impact);
  const [owner, setOwner] = useState(risk.owner ?? "");
  const [treatment, setTreatment] = useState(risk.treatment ?? "");
  const [saving, setSaving] = useState(false);
  const { severity, status } = computeRiskSeverity({ probability, impact });

  async function save() {
    setSaving(true);
    await createClient()
      .from("risks")
      .update({ probability, impact, owner: owner.trim() || null, treatment: treatment.trim() || null })
      .eq("id", risk.id);
    setSaving(false);
  }

  const levelOptions = [1, 2, 3, 4, 5];

  return (
    <div className="border-l-2 border-danger bg-danger/5 px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span>
          <span className="font-medium text-ink">{risk.name}</span>
          {risk.reason && <span className="text-muted"> — {risk.reason}</span>}
        </span>
        <span className={`shrink-0 font-mono text-xs uppercase tracking-wide ${status === "évalué" ? "text-danger" : "text-muted"}`}>
          {severity !== null ? `${ct.severityLabel} ${severity}/25` : ct.severityNotEvaluated}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-muted">
          {ct.probabilityLabel}
          <select
            value={probability ?? ""}
            onChange={(e) => setProbability(e.target.value ? Number(e.target.value) : null)}
            className="border border-border bg-surface px-1.5 py-1 text-ink"
          >
            <option value="">—</option>
            {levelOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted">
          {ct.impactLabel}
          <select
            value={impact ?? ""}
            onChange={(e) => setImpact(e.target.value ? Number(e.target.value) : null)}
            className="border border-border bg-surface px-1.5 py-1 text-ink"
          >
            <option value="">—</option>
            {levelOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-0.5 text-xs text-muted">
          {ct.ownerLabel}
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="border border-border bg-surface px-1.5 py-1 text-ink" />
        </label>
        <label className="flex min-w-[10rem] flex-[2] flex-col gap-0.5 text-xs text-muted">
          {ct.treatmentLabel}
          <input value={treatment} onChange={(e) => setTreatment(e.target.value)} className="border border-border bg-surface px-1.5 py-1 text-ink" />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="shrink-0 bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-ink disabled:opacity-50"
        >
          {ct.saveLabel}
        </button>
      </div>
    </div>
  );
}

type ActionRowData = {
  id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: ActionStatus;
  source_module: string | null;
};

function ActionsPanel({
  transformationId,
  actions,
  ct,
}: {
  transformationId: string;
  actions: ActionRowData[];
  ct: Dictionary["controlTower"];
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const STATUS_LABELS: Record<ActionStatus, string> = {
    not_started: ct.statusNotStarted,
    in_progress: ct.statusInProgress,
    done: ct.statusDone,
  };

  async function addAction() {
    if (!title.trim()) return;
    await createClient()
      .from("actions")
      .insert({ transformation_id: transformationId, title: title.trim(), owner: owner.trim() || null, due_date: dueDate || null, source_module: "control_tower" });
    setTitle("");
    setOwner("");
    setDueDate("");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      {actions.length === 0 && <p className="text-xs text-muted">{ct.noActions}</p>}
      {actions.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-accent bg-accent/5 px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="font-medium text-ink">{a.title}</span>
            {a.owner && <span className="text-muted"> — {a.owner}</span>}
            {a.due_date && <span className="text-muted"> · {ct.dueDateLabel} {a.due_date}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void createClient().from("actions").update({ status: ACTION_STATUS_CYCLE[a.status] }).eq("id", a.id)}
              className="border border-border px-2 py-1 font-mono text-xs uppercase tracking-wide text-ink hover:border-accent"
            >
              {STATUS_LABELS[a.status]}
            </button>
            <button
              type="button"
              onClick={() => void createClient().from("actions").delete().eq("id", a.id)}
              className="text-muted hover:text-danger"
            >
              {ct.deleteLabel}
            </button>
          </span>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-2 pt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={ct.actionTitlePlaceholder}
          className="min-w-[10rem] flex-[2] border border-border bg-surface px-2 py-1.5 text-xs text-ink"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder={ct.ownerLabel}
          className="min-w-[8rem] flex-1 border border-border bg-surface px-2 py-1.5 text-xs text-ink"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border border-border bg-surface px-2 py-1.5 text-xs text-ink"
        />
        <button type="button" onClick={() => void addAction()} className="shrink-0 bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink">
          {ct.addActionLabel}
        </button>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  t,
  onToggleArchive,
  onMemberInvited,
  onMemberRemoved,
}: {
  project: ControlTowerProject;
  t: Dictionary;
  onToggleArchive: (project: ControlTowerProject) => void;
  onMemberInvited: (transformationId: string, member: TransformationMember) => void;
  onMemberRemoved: (transformationId: string, memberId: string) => void;
}) {
  const { language } = useLanguage();
  const ct = t.controlTower;
  const MODULE_LABELS: Record<ModuleName, string> = {
    decide: t.nav.decide,
    connect: t.nav.connect,
    learn: t.nav.learn,
    deliver: t.nav.deliver,
  };
  const STATUS_LABELS: Record<ModuleStatusValue, string> = {
    not_started: ct.statusNotStarted,
    in_progress: ct.statusInProgress,
    done: ct.statusDone,
  };
  const [panel, setPanel] = useState<Panel>(null);
  const relevantRecs = project.moduleRecommendations.filter((r) => r.relevance !== "not_relevant");
  const winCount = project.opportunities.length + project.keyMetrics.length;

  function toggle(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next));
  }

  const chip = (active: boolean, tone: "danger" | "accent" | "success") => {
    const map = {
      danger: active ? "border-danger bg-danger/15 text-danger" : "border-danger/30 text-danger",
      accent: active ? "border-accent bg-accent/15 text-accent-strong" : "border-accent/30 text-accent-strong",
      success: active ? "border-success bg-success/15 text-success" : "border-success/30 text-success",
    };
    return `flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition disabled:opacity-30 ${map[tone]}`;
  };

  return (
    <article className={`flex flex-col gap-4 border bg-surface p-5 ${project.archived ? "border-border opacity-60" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-xl leading-tight text-ink">{shortName(project, t)}</h3>
            {project.archived && (
              <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-muted">
                {ct.archivedBadge}
              </span>
            )}
          </div>
          {project.summary && <p className="mt-1 line-clamp-1 text-xs text-muted">{project.summary}</p>}
        </div>
        <ProgressRing percent={project.progressPercent} />
      </div>

      <ModulePath moduleStatus={project.moduleStatus} moduleLabels={MODULE_LABELS} statusLabels={STATUS_LABELS} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={project.risks.length === 0} onClick={() => toggle("risks")} className={chip(panel === "risks", "danger")}>
          <AlertIcon aria-hidden className="h-3.5 w-3.5" />
          <span className="tabular-nums">{project.risks.length}</span> {ct.risksLabel}
        </button>
        <button
          type="button"
          disabled={project.pendingValidationCount === 0}
          onClick={() => toggle("confirm")}
          className={chip(panel === "confirm", "accent")}
        >
          <Icon name="question" className="h-3.5 w-3.5" />
          <span className="tabular-nums">{project.pendingValidationCount}</span> {ct.toConfirmLabel}
        </button>
        <button type="button" disabled={winCount === 0} onClick={() => toggle("win")} className={chip(panel === "win", "success")}>
          <TrophyIcon aria-hidden className="h-3.5 w-3.5" />
          <span className="tabular-nums">{winCount}</span> {ct.achievements}
        </button>
        {relevantRecs.length > 0 && (
          <button type="button" onClick={() => toggle("recs")} className={chip(panel === "recs", "accent")}>
            <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            {relevantRecs.length} {ct.recommendedModules}
          </button>
        )}
        <button type="button" onClick={() => toggle("team")} className={chip(panel === "team", "accent")}>
          <Icon name="building" aria-hidden className="h-3.5 w-3.5" />
          <span className="tabular-nums">{project.members.length}</span> {ct.teamLabel}
        </button>
        <button type="button" onClick={() => toggle("actions")} className={chip(panel === "actions", "accent")}>
          <Icon name="archive" className="h-3.5 w-3.5" />
          <span className="tabular-nums">{project.actions.length}</span> {ct.actionsLabel}
        </button>
      </div>

      {panel === "risks" && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <RiskMatrix risks={project.risks} ct={ct} />
          {project.risks.map((r) => (
            <RiskRow key={r.id} risk={r} ct={ct} />
          ))}
        </div>
      )}

      {panel === "actions" && <ActionsPanel transformationId={project.transformationId} actions={project.actions} ct={ct} />}

      {panel === "confirm" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-md text-xs leading-relaxed text-muted">{ct.toConfirmHint}</p>
          <Link
            href={`/decide?transformationId=${project.transformationId}`}
            className="shrink-0 bg-accent px-3.5 py-2 text-xs font-medium text-accent-ink hover:bg-accent-strong"
          >
            {ct.confirmNow}
          </Link>
        </div>
      )}

      {panel === "win" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {project.keyMetrics.map((m) => (
            <div key={m.key} className="flex items-center justify-between border-l-2 border-success bg-success/5 px-3 py-2 text-xs">
              <span className="text-muted">{m.key}</span>
              <span className="font-semibold text-ink">{String(m.value)}</span>
            </div>
          ))}
          {project.opportunities.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 border-l-2 border-success bg-success/5 px-3 py-2 text-xs">
              <span>
                <span className="font-medium text-ink">{o.name}</span>
                {o.reason && <span className="text-muted"> — {o.reason}</span>}
              </span>
              <button
                type="button"
                onClick={() => void createClient().from("opportunities").delete().eq("id", o.id)}
                className="shrink-0 text-muted hover:text-danger"
              >
                {ct.deleteLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {panel === "team" && (
        <TeamPanel
          transformationId={project.transformationId}
          members={project.members}
          t={t}
          onInvited={(member) => onMemberInvited(project.transformationId, member)}
          onRemoved={(memberId) => onMemberRemoved(project.transformationId, memberId)}
        />
      )}

      {panel === "recs" && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {relevantRecs.map((r) => {
            const href = moduleHref(r.module, project.transformationId);
            return (
              <div key={r.module} className="flex items-center justify-between gap-2 border border-border bg-surface-2 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{MODULE_LABELS[r.module]}</span>
                  {r.reason && <span className="text-muted"> — {r.reason}</span>}
                </div>
                {href ? (
                  <Link href={href} className="shrink-0 font-semibold text-accent-strong underline underline-offset-2">
                    {ct.open}
                  </Link>
                ) : (
                  <span className="shrink-0 text-muted">{ct.soon}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <CalendarIcon aria-hidden className="h-3.5 w-3.5" />
          {ct.target} {formatTargetDate(project.targetDate, t, language)}
        </span>
        <button type="button" onClick={() => onToggleArchive(project)} className="flex items-center gap-1 text-muted hover:text-ink">
          <Icon name="archive" className="h-3.5 w-3.5" />
          {project.archived ? ct.unarchive : ct.archive}
        </button>
        <Link
          href={`/impact?transformationId=${project.transformationId}`}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          {t.impact.openImpact}
          <ArrowRightIcon aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

type TodayAction = { key: string; tone: "accent" | "danger" | "live"; icon: IconName; label: string; project: string; href: string };

// At most three things to do now, across all active projects: figures to
// confirm first (they unlock reliable reports), then open risks, then the
// next module on the path.
function todayActions(projects: ControlTowerProject[], t: Dictionary): TodayAction[] {
  const ct = t.controlTower;
  const out: TodayAction[] = [];
  for (const p of projects) {
    if (p.pendingValidationCount > 0)
      out.push({
        key: `v-${p.transformationId}`,
        tone: "accent",
        icon: "question",
        label: `${p.pendingValidationCount} ${ct.actionValidate}`,
        project: shortName(p, t),
        href: `/decide?transformationId=${p.transformationId}`,
      });
  }
  for (const p of projects) {
    if (p.risks.length > 0)
      out.push({
        key: `r-${p.transformationId}`,
        tone: "danger",
        icon: "alert",
        label: `${p.risks.length} ${ct.actionRisks}`,
        project: shortName(p, t),
        href: `/impact?transformationId=${p.transformationId}`,
      });
  }
  for (const p of projects) {
    const m = nextModule(p);
    const href = m ? moduleHref(m, p.transformationId) : null;
    if (m && href)
      out.push({
        key: `m-${p.transformationId}`,
        tone: "live",
        icon: m,
        label: `${ct.actionStart} ${t.nav[m]}`,
        project: shortName(p, t),
        href,
      });
  }
  return out.slice(0, 3);
}

export function ControlTowerView({
  userId,
  initialProjects,
}: {
  userId: string;
  initialProjects: ControlTowerProject[];
}) {
  const { t } = useLanguage();
  const ct = t.controlTower;
  const [projects, setProjects] = useState(initialProjects);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "hot" | "done" | "archived">("all");

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const next = await fetchControlTowerProjects(supabase, userId, t.common.untitledProject);
    setProjects(next);
    setLastSync(new Date());
  }, [userId, t.common.untitledProject]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "actions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "trajectories" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transformations" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  async function toggleArchive(project: ControlTowerProject) {
    const next = !project.archived;
    setProjects((prev) => prev.map((p) => (p.transformationId === project.transformationId ? { ...p, archived: next } : p)));
    await createClient()
      .from("transformations")
      .update({ status: next ? "archived" : "active" })
      .eq("id", project.transformationId);
  }

  function handleMemberInvited(transformationId: string, member: TransformationMember) {
    setProjects((prev) =>
      prev.map((p) => (p.transformationId === transformationId ? { ...p, members: [...p.members, member] } : p))
    );
  }

  function handleMemberRemoved(transformationId: string, memberId: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.transformationId === transformationId ? { ...p, members: p.members.filter((m) => m.id !== memberId) } : p
      )
    );
  }

  const active = projects.filter((p) => !p.archived);
  const totalRisks = active.reduce((n, p) => n + p.risks.length, 0);
  const totalToConfirm = active.reduce((n, p) => n + p.pendingValidationCount, 0);
  const totalWin = active.reduce((n, p) => n + p.opportunities.length + p.keyMetrics.length, 0);
  const actions = todayActions(active, t);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => {
    const matchesQuery =
      normalizedQuery === "" ||
      p.title.toLowerCase().includes(normalizedQuery) ||
      p.summary.toLowerCase().includes(normalizedQuery) ||
      p.organizationName.toLowerCase().includes(normalizedQuery);
    if (!matchesQuery) return false;
    if (statusFilter === "archived") return p.archived;
    if (p.archived) return false;
    if (statusFilter === "hot") return p.risks.length + p.pendingValidationCount > 0;
    if (statusFilter === "done") return MODULE_ORDER.every((m) => p.moduleStatus[m] === "done");
    return true;
  });

  const toneClass: Record<TodayAction["tone"], string> = {
    accent: "text-accent-strong",
    danger: "text-danger",
    live: "text-live",
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>{ct.eyebrow}</Eyebrow>
          <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{ct.title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LivePulse lastSync={lastSync} t={t} />
          {projects.length > 0 && (
            <ExportPdfButton
              kind="control-tower"
              payload={{ projects: active }}
              filename="4tomorrow-tour-de-controle.pdf"
              label={ct.exportPdf}
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={ct.projects} value={active.length} />
        <StatTile label={ct.risksLabel} value={totalRisks} tone={totalRisks > 0 ? "danger" : undefined} />
        <StatTile label={ct.toConfirmLabel} value={totalToConfirm} tone={totalToConfirm > 0 ? "accent" : undefined} />
        <StatTile label={ct.achievements} value={totalWin} />
      </div>

      {active.length > 0 && (
        <section className="mt-8 border border-border bg-surface p-5">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent-strong">{ct.todayTitle}</h2>
          {actions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{ct.todayEmpty}</p>
          ) : (
            <ol className="mt-3 flex flex-col divide-y divide-border">
              {actions.map((a, i) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-4 py-3">
                    <span className="font-display text-2xl leading-none text-muted tabular-nums">{i + 1}</span>
                    <Icon name={a.icon} className={`h-5 w-5 shrink-0 ${toneClass[a.tone]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{a.label}</span>
                      <span className="block truncate text-xs text-muted">{a.project}</span>
                    </span>
                    <ArrowRightIcon aria-hidden className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-strong" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="mt-6">
        <Link
          href="/decide"
          className="inline-flex items-center gap-2 bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:bg-accent-strong"
        >
          {ct.newDiagnostic}
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">{ct.emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ct.searchPlaceholder}
                className="w-full border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {(["all", "hot", "done", "archived"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`border px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === f
                      ? "border-accent bg-accent/15 text-accent-strong"
                      : "border-border bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {f === "all" ? ct.filterAll : f === "hot" ? ct.filterHot : f === "done" ? ct.filterDone : ct.filterArchived}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="mt-6 border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-sm text-muted">{ct.noResults}</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {filteredProjects.map((p) => (
                <ProjectCard
                  key={p.transformationId}
                  project={p}
                  t={t}
                  onToggleArchive={toggleArchive}
                  onMemberInvited={handleMemberInvited}
                  onMemberRemoved={handleMemberRemoved}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
