import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { MODULE_COLORS } from "@/lib/module-colors";
import { Icon, type IconName } from "@/components/icons";

type ModuleDef = {
  key: "decide" | "connect" | "learn" | "deliver";
  href: string;
  active: boolean;
};

const MODULE_DEFS: ModuleDef[] = [
  { key: "decide", href: "/decide", active: true },
  { key: "connect", href: "/connect", active: true },
  { key: "learn", href: "/learn", active: true },
  { key: "deliver", href: "/deliver", active: true },
];

const SECTOR_ICONS: IconName[] = ["plane", "car", "boat", "bolt", "health", "factory"];
const CALENDLY_URL = "https://calendly.com/salma-jalil-ing/30min";

// Diamond layout, spokes to the hub plus edges between neighbors — reads
// as one connected mesh, not four unrelated tiles. Same visual language
// (gold nodes/lines on dark surface) as the Connect ecosystem diagram.
const DIAGRAM_SIZE = 320;
const DIAGRAM_CENTER = DIAGRAM_SIZE / 2;
const NODE_RADIUS = 118;
const NODE_R = 40;

function ModuleNetwork({ t }: { t: Dictionary }) {
  const modules = MODULE_DEFS.map((mod) => ({
    ...mod,
    label: t.nav[mod.key],
    blurb: t.home.moduleBlurbs[mod.key],
  }));
  const positions = modules.map((mod, i) => {
    const angle = -90 + (360 / modules.length) * i;
    const rad = (angle * Math.PI) / 180;
    return {
      ...mod,
      x: DIAGRAM_CENTER + NODE_RADIUS * Math.cos(rad),
      y: DIAGRAM_CENTER + NODE_RADIUS * Math.sin(rad),
    };
  });

  return (
    <div className="border border-border bg-surface p-4 sm:p-6">
      <svg
        viewBox={`0 0 ${DIAGRAM_SIZE} ${DIAGRAM_SIZE}`}
        role="img"
        aria-label={t.home.platformLabel}
        className="mx-auto block w-full max-w-xs"
      >
        {positions.map((node) => (
          <line
            key={`spoke-${node.key}`}
            x1={DIAGRAM_CENTER}
            y1={DIAGRAM_CENTER}
            x2={node.x}
            y2={node.y}
            stroke={MODULE_COLORS[node.key].accent}
            strokeOpacity={0.7}
            strokeWidth={1.5}
            className="eco-flow"
          />
        ))}
        {positions.map((node, i) => {
          const next = positions[(i + 1) % positions.length];
          return (
            <line
              key={`edge-${node.key}`}
              x1={node.x}
              y1={node.y}
              x2={next.x}
              y2={next.y}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          );
        })}

        <circle cx={DIAGRAM_CENTER} cy={DIAGRAM_CENTER} r={34} fill="var(--surface-2)" stroke="var(--accent)" strokeWidth={2} />
        <text x={DIAGRAM_CENTER} y={DIAGRAM_CENTER - 3} textAnchor="middle" fill="var(--accent)" fontSize={10} fontWeight={700} letterSpacing="0.06em">
          4
        </text>
        <text x={DIAGRAM_CENTER} y={DIAGRAM_CENTER + 11} textAnchor="middle" fill="var(--ink)" fontSize={9} fontWeight={600} letterSpacing="0.04em">
          TOMORROW
        </text>

        {positions.map((node) => {
          const color = MODULE_COLORS[node.key];
          return (
            <g key={node.key}>
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_R}
                fill={node.active ? color.accent : "var(--surface-2)"}
                fillOpacity={node.active ? 0.16 : 1}
                stroke={node.active ? color.accent : "var(--border)"}
                strokeWidth={1.5}
              />
              <text x={node.x} y={node.y - 2} textAnchor="middle" fill={node.active ? color.strong : "var(--muted)"} fontSize={12} fontWeight={700}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 13} textAnchor="middle" fill="var(--muted)" fontSize={7.5}>
                {node.active ? "" : t.home.comingSoon}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {modules.map((mod) =>
          mod.href ? (
            <Link
              key={mod.key}
              href={mod.href}
              style={{ borderTopColor: MODULE_COLORS[mod.key].accent, borderTopWidth: 3 }}
              className="flex flex-col gap-1 border border-border bg-surface-2 px-3 py-3 text-left text-xs leading-snug text-muted transition hover:text-ink"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Icon name={mod.key} className="h-4 w-4" style={{ color: MODULE_COLORS[mod.key].accent }} />
                {mod.label}
              </span>
              {mod.blurb}
            </Link>
          ) : (
            <div key={mod.key} className="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-center text-xs text-muted opacity-60">
              <span className="block font-semibold">{mod.label}</span>
              {mod.blurb}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getLanguage();
  const t = getDictionary(language);

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent)",
        }}
      />

      {/* Hero: one promise, one action. */}
      <section className="flex flex-col items-start">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Eyebrow>{t.home.brandEyebrow}</Eyebrow>
          {user && (
            <Link
              href="/control-tower"
              className="hidden items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-ink sm:flex"
            >
              <Icon name="tower" className="h-3.5 w-3.5" />
              {t.nav.controlTower}
            </Link>
          )}
        </div>
        <h1 className="mt-6 max-w-3xl text-balance font-display text-5xl leading-[1.02] text-ink sm:text-7xl">
          {t.home.heroTitlePrefix} <span className="text-accent-strong italic">{t.home.heroTitleAccent}</span>
        </h1>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-accent-strong">{t.home.tagline}</p>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-body">{t.home.heroDescription}</p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href={user ? "/decide" : "/login?next=/decide"}
            className="bg-accent px-6 py-3.5 text-center text-base font-medium text-accent-ink shadow-[0_0_30px_-8px_var(--accent)] transition hover:bg-accent-strong"
          >
            {t.home.launchDiagnostic}
          </Link>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border-strong px-6 py-3.5 text-center text-base text-ink transition hover:border-accent"
          >
            {t.home.bookCall}
          </a>
        </div>
      </section>

      {/* What you get: three facts, no paragraph. */}
      <section className="mt-16">
        <Eyebrow>{t.home.proofTitle}</Eyebrow>
        <div className="mt-4 grid grid-cols-1 border border-border sm:grid-cols-3">
          {t.home.proofs.map((p, i) => (
            <div key={i} className={`flex items-start gap-4 bg-surface p-5 ${i > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""}`}>
              <span className="font-display text-6xl leading-none text-accent-strong tabular-nums">{p.value}</span>
              <span className="pt-1 text-sm leading-snug text-body">{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The four connected modules. */}
      <section className="mt-16">
        <Eyebrow>{t.home.platformLabel}</Eyebrow>
        <p className="mt-3 max-w-xl text-sm text-muted">{t.home.platformIntro}</p>
        <div className="mt-4">
          <ModuleNetwork t={t} />
        </div>
      </section>

      {/* Cross-industry value. */}
      <section className="mt-16 grid gap-6 border border-border bg-surface p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:p-8">
        <div>
          <h2 className="text-balance font-display text-3xl leading-tight text-ink">{t.home.crossTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t.home.crossBody}</p>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {t.home.sectors.map((label, i) => (
            <li key={label} className="flex flex-col items-center gap-2 border border-border bg-surface-2 px-2 py-4 text-center">
              <Icon name={SECTOR_ICONS[i] ?? "factory"} className="h-6 w-6 text-accent-strong" />
              <span className="text-xs text-body">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works: four steps, one line each. */}
      <section className="mt-16">
        <Eyebrow>{t.home.stepsTitle}</Eyebrow>
        <ol className="mt-4 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-4">
          {t.home.steps.map((step, i) => (
            <li key={i} className="bg-surface p-5">
              <span className="font-mono text-[11px] tracking-[0.18em] text-accent-strong">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-display text-xl text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-snug text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={user ? "/decide" : "/login?next=/decide"}
          className="bg-accent px-6 py-3 text-base font-medium text-accent-ink transition hover:bg-accent-strong"
        >
          {t.home.launchDiagnostic}
        </Link>
        <Link href="/ecosystem/join" className="text-sm text-muted underline underline-offset-4 hover:text-accent-strong">
          {t.home.joinAsPartner}
        </Link>
      </div>
    </div>
  );
}
