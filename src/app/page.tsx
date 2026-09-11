import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";

const MODULES = [
  {
    key: "connect",
    label: "Connect",
    blurb: "The right opportunities.",
    href: "/connect",
    active: true,
    icon: (
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 6 2 6 5" />
    ),
  },
  {
    key: "learn",
    label: "Learn",
    blurb: "Develop expertise.",
    href: null,
    active: false,
    icon: <path d="M2 8l10-5 10 5-10 5-10-5Zm4 2v6c0 1.5 3 3 6 3s6-1.5 6-3v-6" />,
  },
  {
    key: "decide",
    label: "Decide",
    blurb: "Make better decisions.",
    href: "/decide",
    active: true,
    icon: <path d="M4 20V10m6 10V4m6 16v-7" />,
  },
  {
    key: "deliver",
    label: "Deliver",
    blurb: "Turn plans into impact.",
    href: null,
    active: false,
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    ),
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        Industry · Technology · Talent · Impact
      </span>
      <h1 className="mt-5 font-display text-4xl text-ink sm:text-5xl">
        From complexity <span className="text-accent">to action.</span>
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted">
        Le module <span className="text-ink">Connect</span> de la plateforme 4 Tomorrow : décris
        ton industrie et ton projet, reçois des technologies, startups, experts, partenaires et
        pistes de financement réels — vérifiables, contactables, et justifiés par le gap
        qu&apos;ils adressent.
      </p>
      <Link
        href={user ? "/connect" : "/login?next=/connect"}
        className="mt-8 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-ink shadow-[0_0_30px_-8px_var(--accent)] transition hover:bg-accent-strong"
      >
        Lancer un matching
      </Link>
      <Link href="/ecosystem/join" className="mt-3 text-sm text-muted underline underline-offset-2 hover:text-accent">
        Ou rejoindre l&apos;écosystème en tant que partenaire
      </Link>

      <div className="mt-16 w-full text-left">
        <Eyebrow>La plateforme</Eyebrow>
        <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {MODULES.map((mod) => {
            const content = (
              <div
                className={`flex h-full flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  mod.active
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface opacity-60"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    mod.active ? "border-accent" : "border-border"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={mod.active ? "var(--accent)" : "var(--muted)"}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    {mod.icon}
                  </svg>
                </span>
                <span className={`text-sm font-semibold ${mod.active ? "text-ink" : "text-muted"}`}>
                  {mod.label}
                </span>
                <span className="text-xs text-muted">{mod.active ? mod.blurb : "Bientôt"}</span>
              </div>
            );
            return mod.href ? (
              <Link key={mod.key} href={mod.href}>
                {content}
              </Link>
            ) : (
              <div key={mod.key}>{content}</div>
            );
          })}
        </div>
      </div>

      <div className="mt-12 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">01 — Décris ton projet</p>
          <p className="mt-1 text-sm text-muted">
            Industrie, partenaires recherchés, zone et budget — en quelques étapes rapides.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">02 — Matching IA</p>
          <p className="mt-1 text-sm text-muted">
            Recherche web en temps réel + répertoire vivant de l&apos;écosystème.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-accent">03 — Passe à l&apos;action</p>
          <p className="mt-1 text-sm text-muted">
            Brief stratégique, idées concrètes, carte de ton écosystème, contacts cliquables.
          </p>
        </div>
      </div>
    </div>
  );
}
