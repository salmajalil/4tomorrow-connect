"use client";

import { useMemo, useState } from "react";
import type { ModelOutput, MatchOutput } from "@/lib/matching";
import { EcosystemDiagram } from "@/components/connect/ecosystem-diagram";
import { Eyebrow } from "@/components/eyebrow";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/components/language-provider";
import { BRICKS, brickOf, countByBrick, splitCompetitorReferences, type BrickKey } from "@/lib/ecosystem-bricks";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { SupplierAssessmentPanel } from "@/components/connect/supplier-assessment-panel";

// Shortlist kept in this browser: a light, per-viewer convenience until the
// shortlist gets its own column in the database.
function useShortlist(storageKey: string) {
  const [list, setList] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  function toggle(name: string) {
    setList((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  return { list, toggle };
}

// The label used to live only in a `title` tooltip — invisible on a touch
// screen, so "9/10" next to a real company name read as an unlabeled,
// unexplained rating of the firm itself instead of "how well this match
// fits your need." Now always visible as text, never hover-only.
function FitGauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(10, Math.round(value)));
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`h-2.5 w-1.5 ${i < Math.round(v / 2) ? "bg-accent" : "bg-border"}`} />
        ))}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted">{v}/10</span>
    </span>
  );
}

// Connecter — "Demander un rendez-vous". No mailer exists anywhere in this
// codebase (same finding as the team-invite feature) — this only records
// the request server-side; requestMeetingNotice says so plainly instead of
// pretending a mail went out.
function RequestMeetingForm({
  matchId,
  transformationId,
  partnerName,
  t,
  onClose,
}: {
  matchId: string | null;
  transformationId: string | null;
  partnerName: string;
  t: Dictionary;
  onClose: () => void;
}) {
  const r = t.connect.results;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transformationId) return null;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/connect/request-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transformationId,
          matchId,
          partnerName,
          requesterName: name,
          requesterEmail: email,
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || r.requestMeetingError);
        return;
      }
      setDone(true);
    } catch {
      setError(r.requestMeetingError);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
        <p className="font-medium text-success">✓ {r.requestMeetingSuccess}</p>
        <p className="text-muted">{r.requestMeetingNotice}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-border pt-3 text-xs">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={r.requestMeetingName}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={r.requestMeetingEmail}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={r.requestMeetingMessagePlaceholder}
        rows={2}
        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || !name.trim() || !email.trim()}
          onClick={() => void submit()}
          className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? r.requestMeetingSubmitting : r.requestMeetingSubmit}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 font-medium text-ink transition hover:border-accent/50"
        >
          {r.requestMeetingCancel}
        </button>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  matchId,
  transformationId,
  t,
  shortlisted,
  onToggle,
  brickLabel,
  watchOnly = false,
}: {
  match: MatchOutput;
  matchId: string | null;
  transformationId: string | null;
  t: Dictionary;
  shortlisted: boolean;
  onToggle: () => void;
  brickLabel: string;
  // Competitor reference (internal market watch): no fit gauge, no
  // shortlist, no meeting request — nothing that reads as a recommendation.
  watchOnly?: boolean;
}) {
  const r = t.connect.results;
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const brick = BRICKS.find((b) => b.key === brickOf(match.category));
  return (
    <article
      className={`flex flex-col gap-3 border p-4 transition ${
        watchOnly ? "border-dashed border-border-strong bg-surface-2" : shortlisted ? "border-accent bg-surface" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-muted">
            {brick && <Icon name={brick.icon} className="h-3 w-3" />}
            {brickLabel}
          </p>
          <h4 className="mt-1 font-display text-xl leading-tight text-ink">{match.name}</h4>
        </div>
        {watchOnly ? (
          <span className="shrink-0 border border-dashed border-border-strong px-2 py-1 text-xs font-medium text-muted">{r.competitorBadge}</span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={shortlisted}
            className={`flex shrink-0 items-center gap-1 border px-2.5 py-1.5 text-xs font-medium transition ${
              shortlisted ? "border-accent bg-accent text-accent-ink" : "border-border-strong text-ink hover:border-accent"
            }`}
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            {shortlisted ? r.shortlisted : r.shortlist}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {!watchOnly && typeof match.fit === "number" && match.fit > 0 && <FitGauge value={match.fit} label={r.fit} />}
        {/* Provenance, always visible as text on every card (never a
            tooltip): the 4 Tomorrow registry vs. a live web search. */}
        {match.source === "registry" ? (
          <span className="flex items-center gap-1 border border-success/40 px-1.5 py-0.5 text-xs font-medium text-success">
            <Icon name="check" className="h-3 w-3" />
            {r.registrySource}
          </span>
        ) : (
          <span className="border border-border-strong px-1.5 py-0.5 text-xs font-medium text-body">{r.webSource}</span>
        )}
        {match.gapAddressed && (
          <span className="border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-body">{match.gapAddressed}</span>
        )}
      </div>

      <p className={`text-sm leading-relaxed text-muted ${open ? "" : "line-clamp-2"}`}>{match.reason}</p>
      {match.reason.length > 140 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="self-start text-xs text-accent-strong underline-offset-4 hover:underline">
          {open ? r.readLess : r.readMore}
        </button>
      )}

      {(match.website || match.contactEmail) && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
          {match.website && (
            <a href={match.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-strong underline underline-offset-2">
              {r.viewSite}
            </a>
          )}
          {match.contactEmail && (
            <a href={`mailto:${match.contactEmail}`} className="font-medium text-accent-strong underline underline-offset-2">
              {match.contactEmail}
            </a>
          )}
        </div>
      )}

      {!watchOnly && transformationId && !requesting && (
        <button
          type="button"
          onClick={() => setRequesting(true)}
          className="self-start border-t border-border pt-3 text-xs font-medium text-accent-strong underline-offset-4 hover:underline"
        >
          {r.requestMeeting}
        </button>
      )}
      {requesting && (
        <RequestMeetingForm
          matchId={matchId}
          transformationId={transformationId}
          partnerName={match.name}
          t={t}
          onClose={() => setRequesting(false)}
        />
      )}

      {/* C02 — pertinence fournisseur : seulement pour les matches "supplier",
          c'est le périmètre exact de la règle métier du brief. */}
      {!watchOnly && match.category === "supplier" && <SupplierAssessmentPanel matchId={matchId} transformationId={transformationId} />}
    </article>
  );
}

export function MatchResults({
  result,
  matchIds,
  transformationId = null,
  projectLabel,
  storageKey = "connect-shortlist",
  canSeeCompetitors = true,
}: {
  result: ModelOutput;
  // C02 — DB id of each match, same order as result.matches (see
  // src/app/api/match/route.ts); absent/undefined entries just mean the
  // assessment panel won't offer saving for that card.
  matchIds?: (string | null)[];
  transformationId?: string | null;
  projectLabel?: string;
  storageKey?: string;
  // Veille concurrentielle interne : réservée au propriétaire et au
  // consultant (modifie tout / porte la stratégie) — pas au client (son
  // usine) ni à l'expert (son domaine), qui n'ont pas besoin de voir les
  // concurrents directs de 4 Tomorrow. Par défaut true (session fraîche,
  // hors transformation partagée : l'utilisateur qui lance le matching est
  // toujours propriétaire ou consultant).
  canSeeCompetitors?: boolean;
}) {
  const { t } = useLanguage();
  const r = t.connect.results;
  const [active, setActive] = useState<BrickKey | "shortlist" | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const { list: shortlist, toggle } = useShortlist(storageKey);

  // Competitor references (same job as 4 Tomorrow) never count in a brick
  // nor appear among the recommendations — see their own section below.
  const counts = useMemo(() => countByBrick(result.matches), [result.matches]);
  const covered = BRICKS.filter((b) => counts[b.key] > 0).length;

  // Carry each match's DB id along through sort/filter so the assessment
  // panel still knows which row to save against after reordering.
  const withIds = result.matches.map((m, i) => ({ match: m, matchId: matchIds?.[i] ?? null, category: m.category }));
  const { recommendations, competitors } = splitCompetitorReferences(withIds);
  const sorted = [...recommendations].sort((a, b) => (b.match.fit ?? 0) - (a.match.fit ?? 0));
  const visible =
    active === "shortlist"
      ? sorted.filter((x) => shortlist.includes(x.match.name))
      : active
        ? sorted.filter((x) => brickOf(x.match.category) === active)
        : sorted;

  return (
    <div className="flex flex-col gap-8">
      {/* Key message first: the brief, three actions, then the ecosystem. */}
      <section className="border border-border bg-surface p-5">
        <Eyebrow>{r.strategicBrief}</Eyebrow>
        <p className={`mt-3 text-base leading-relaxed text-ink ${briefOpen ? "" : "line-clamp-3"}`}>{result.strategicBrief}</p>
        {result.strategicBrief.length > 260 && (
          <button type="button" onClick={() => setBriefOpen((v) => !v)} className="mt-2 text-xs text-accent-strong underline-offset-4 hover:underline">
            {briefOpen ? r.readLess : r.readMore}
          </button>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {result.goodIdeas.slice(0, 3).map((idea, i) => (
            <div key={i} className="border-t-2 border-accent pt-3">
              <span className="font-display text-2xl leading-none text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 text-sm leading-snug text-body">{idea}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Eyebrow>{r.yourEcosystem}</Eyebrow>
          <p className="flex items-baseline gap-4 text-xs text-muted">
            <span>
              <span className="font-display text-2xl text-ink tabular-nums">{recommendations.length}</span> {r.actorsFound}
            </span>
            <span>
              <span className="font-display text-2xl text-ink tabular-nums">{covered}</span> {r.bricksCovered}
            </span>
          </p>
        </div>

        <div className="mt-4 grid items-center gap-6 border border-border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <EcosystemDiagram
            projectLabel={projectLabel ?? r.yourProject}
            centerLabel={r.yourProject}
            counts={counts}
            labels={r.bricks}
            active={active === "shortlist" ? null : active}
            onSelect={setActive}
          />
          <ul className="flex flex-col gap-1">
            {BRICKS.map((b) => {
              const on = active === b.key;
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => setActive(on ? null : b.key)}
                    className={`flex w-full items-start gap-3 border-l-2 px-3 py-2 text-left transition ${
                      on ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <Icon name={b.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${counts[b.key] ? "text-accent-strong" : "text-muted"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm font-medium ${counts[b.key] ? "text-ink" : "text-muted"}`}>{r.bricks[b.key]}</span>
                        <span className="font-mono text-xs tabular-nums text-muted">{counts[b.key]}</span>
                      </span>
                      {on && <span className="mt-0.5 block text-xs text-muted">{r.brickHints[b.key]}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-2 text-xs text-muted">{r.tapBrick}</p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive(null)}
            className={`border px-3 py-1.5 text-xs font-medium ${active === null ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted hover:text-ink"}`}
          >
            {r.allBricks} · {recommendations.length}
          </button>
          {BRICKS.filter((b) => counts[b.key] > 0).map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setActive(b.key)}
              className={`border px-3 py-1.5 text-xs font-medium ${active === b.key ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted hover:text-ink"}`}
            >
              {r.bricks[b.key]} · {counts[b.key]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActive("shortlist")}
            className={`ml-auto flex items-center gap-1 border px-3 py-1.5 text-xs font-medium ${
              active === "shortlist" ? "border-accent bg-accent text-accent-ink" : "border-accent/40 text-accent-strong"
            }`}
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            {r.myShortlist} · {shortlist.length}
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="border border-dashed border-border p-6 text-center text-sm text-muted">
            {active === "shortlist" ? r.shortlistEmpty : r.brickEmpty}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map(({ match: m, matchId }, i) => (
              <MatchCard
                key={`${m.name}-${i}`}
                match={m}
                matchId={matchId}
                transformationId={transformationId}
                t={t}
                shortlisted={shortlist.includes(m.name)}
                onToggle={() => toggle(m.name)}
                brickLabel={r.bricks[brickOf(m.category) ?? "strategy"]}
              />
            ))}
          </div>
        )}
      </section>

      {/* Same-sector players (category "competitor_reference"): kept for the
          firm's internal market watch, in their own dashed section, never
          mixed into the recommendations above, the bricks or the counts. */}
      {competitors.length > 0 && canSeeCompetitors && (
        <section aria-labelledby="connect-competitors-title" className="flex flex-col gap-3 border border-dashed border-border-strong p-4">
          <div>
            <h3 id="connect-competitors-title" className="text-sm font-semibold text-ink">
              {r.competitorsTitle}
            </h3>
            <p className="mt-1 text-xs text-muted">{r.competitorsHint}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {competitors.map(({ match: m, matchId }, i) => (
              <MatchCard
                key={`competitor-${m.name}-${i}`}
                match={m}
                matchId={matchId}
                transformationId={transformationId}
                t={t}
                shortlisted={false}
                onToggle={() => {}}
                brickLabel={r.categoryCompetitorReference}
                watchOnly
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
