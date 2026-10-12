"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModelOutput, MatchOutput } from "@/lib/matching";
import { EcosystemDiagram } from "@/components/connect/ecosystem-diagram";
import { Eyebrow } from "@/components/eyebrow";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/components/language-provider";
import { BRICKS, brickOf, type BrickKey } from "@/lib/ecosystem-bricks";
import type { Dictionary } from "@/lib/i18n/dictionary";

// Shortlist kept in this browser: a light, per-viewer convenience until the
// shortlist gets its own column in the database.
function useShortlist(storageKey: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setList(JSON.parse(raw) as string[]);
    } catch {
      /* storage unavailable: start empty */
    }
  }, [storageKey]);
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

function FitGauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(10, Math.round(value)));
  return (
    <span className="flex items-center gap-1.5" title={`${label} ${v}/10`}>
      <span className="flex gap-[2px]" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`h-2.5 w-1.5 ${i < Math.round(v / 2) ? "bg-accent" : "bg-border"}`} />
        ))}
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-muted">{v}/10</span>
    </span>
  );
}

function MatchCard({
  match,
  t,
  shortlisted,
  onToggle,
  brickLabel,
}: {
  match: MatchOutput;
  t: Dictionary;
  shortlisted: boolean;
  onToggle: () => void;
  brickLabel: string;
}) {
  const r = t.connect.results;
  const [open, setOpen] = useState(false);
  const brick = BRICKS.find((b) => b.key === brickOf(match.category));
  return (
    <article className={`flex flex-col gap-3 border bg-surface p-4 transition ${shortlisted ? "border-accent" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {brick && <Icon name={brick.icon} className="h-3 w-3" />}
            {brickLabel}
          </p>
          <h4 className="mt-1 font-display text-xl leading-tight text-ink">{match.name}</h4>
        </div>
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
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {typeof match.fit === "number" && match.fit > 0 && <FitGauge value={match.fit} label={r.fit} />}
        {match.source === "registry" && (
          <span className="border border-success/40 px-1.5 py-0.5 text-[10.5px] font-medium text-success">{r.registrySource}</span>
        )}
        {match.gapAddressed && (
          <span className="border border-border bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-body">{match.gapAddressed}</span>
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
    </article>
  );
}

export function MatchResults({
  result,
  projectLabel,
  storageKey = "connect-shortlist",
}: {
  result: ModelOutput;
  projectLabel?: string;
  storageKey?: string;
}) {
  const { t } = useLanguage();
  const r = t.connect.results;
  const [active, setActive] = useState<BrickKey | "shortlist" | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const { list: shortlist, toggle } = useShortlist(storageKey);

  const counts = useMemo(() => {
    const c = Object.fromEntries(BRICKS.map((b) => [b.key, 0])) as Record<BrickKey, number>;
    for (const m of result.matches) c[brickOf(m.category)] += 1;
    return c;
  }, [result.matches]);
  const covered = BRICKS.filter((b) => counts[b.key] > 0).length;

  const sorted = [...result.matches].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));
  const visible =
    active === "shortlist"
      ? sorted.filter((m) => shortlist.includes(m.name))
      : active
        ? sorted.filter((m) => brickOf(m.category) === active)
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
              <span className="font-display text-2xl text-ink tabular-nums">{result.matches.length}</span> {r.actorsFound}
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
            {r.allBricks} · {result.matches.length}
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
            {visible.map((m, i) => (
              <MatchCard
                key={`${m.name}-${i}`}
                match={m}
                t={t}
                shortlisted={shortlist.includes(m.name)}
                onToggle={() => toggle(m.name)}
                brickLabel={r.bricks[brickOf(m.category)]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
