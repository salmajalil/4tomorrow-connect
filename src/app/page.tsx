import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";
import { MODULE_COLORS } from "@/lib/module-colors";

type ModuleDef = {
  key: "decide" | "connect" | "learn" | "deliver";
  href: string;
  active: boolean;
  icon: React.ReactNode;
};

const MODULE_DEFS: ModuleDef[] = [
  { key: "decide", href: "/decide", active: true, icon: <path d="M4 20V10m6 10V4m6 16v-7" /> },
  {
    key: "connect",
    href: "/connect",
    active: true,
    icon: (
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 6 2 6 5" />
    ),
  },
  { key: "learn", href: "/learn", active: true, icon: <path d="M2 8l10-5 10 5-10 5-10-5Zm4 2v6c0 1.5 3 3 6 3s6-1.5 6-3v-6" /> },
  {
    key: "deliver",
    href: "/deliver",
    active: true,
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    ),
  },
];

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
    <div className="rounded-xl border border-border bg-surface p-4">
      <svg
        viewBox={`0 0 ${DIAGRAM_SIZE} ${DIAGRAM_SIZE}`}
        role="img"
        aria-label={t.home.platformLabel}
        className="mx-auto block w-full max-w-xs"
      >
        {positions.map((node) => (
          <line key={`spoke-${node.key}`} x1={DIAGRAM_CENTER} y1={DIAGRAM_CENTER} x2={node.x} y2={node.y} stroke="var(--border)" strokeWidth={1.5} />
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
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-center text-xs text-muted transition hover:text-ink"
            >
              <span className="block font-semibold text-ink">{mod.label}</span>
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
    <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 35%, transparent), transparent)",
        }}
      />

      <div className="flex w-full items-center justify-between">
        <Eyebrow>{t.home.brandEyebrow}</Eyebrow>
        {user && (
          <Link
            href="/control-tower"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-ink"
          >
            <span aria-hidden>📡</span>
            {t.nav.controlTower}
          </Link>
        )}
      </div>

      <h1 className="mt-5 font-display text-4xl text-ink sm:text-5xl">
        {t.home.heroTitlePrefix} <span className="text-accent">{t.home.heroTitleAccent}</span>
      </h1>
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">{t.home.tagline}</p>
      <p className="mt-4 max-w-xl text-balance text-muted">
        {t.home.heroIntro} <span className="text-ink">Decide</span> {t.home.heroDecideAction}{" "}
        <span className="text-ink">Connect</span> {t.home.heroConnectParenthetical}{" "}
        <span className="text-ink">Learn</span> {t.home.heroLearnParenthetical}{" "}
        <span className="text-ink">Deliver</span> {t.home.heroDeliverParenthetical} {t.home.heroOutro}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href={user ? "/decide" : "/login?next=/decide"}
          className="rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-ink shadow-[0_0_30px_-8px_var(--accent)] transition hover:bg-accent-strong"
        >
          {t.home.launchDiagnostic}
        </Link>
        <Link href="/ecosystem/join" className="text-sm text-muted underline underline-offset-2 hover:text-accent">
          {t.home.joinAsPartner}
        </Link>
      </div>

      <div className="mt-16 w-full text-left">
        <Eyebrow>{t.home.platformLabel}</Eyebrow>
        <div className="mt-4">
          <ModuleNetwork t={t} />
        </div>
      </div>

      <div className="mt-12 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">{t.home.step1Title}</p>
          <p className="mt-1 text-sm text-muted">{t.home.step1Body}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">{t.home.step2Title}</p>
          <p className="mt-1 text-sm text-muted">{t.home.step2Body}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">{t.home.step3Title}</p>
          <p className="mt-1 text-sm text-muted">{t.home.step3Body}</p>
        </div>
      </div>
    </div>
  );
}
