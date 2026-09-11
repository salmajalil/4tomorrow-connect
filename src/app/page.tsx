import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 35%, transparent), transparent)",
        }}
      />

      <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-strong">
        Connect
      </span>
      <h1 className="mt-5 font-display text-4xl tracking-wide text-ink sm:text-5xl">
        L&apos;écosystème de partenaires pour ta transformation industrielle
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted">
        Décris ton industrie et ton projet, et reçois des technologies, startups, experts,
        partenaires et pistes de financement réels — vérifiables, contactables, et justifiés par
        le gap qu&apos;ils adressent.
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

      <div className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
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
