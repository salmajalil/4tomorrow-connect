import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
        CONNECT
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
        L&apos;écosystème de partenaires pour ta transformation industrielle
      </h1>
      <p className="mt-4 max-w-xl text-balance text-neutral-600">
        Décris ton industrie et ton projet, et reçois en quelques secondes des
        technologies, startups, experts et partenaires réels — vérifiables,
        contactables, et justifiés par le gap qu&apos;ils adressent.
      </p>
      <Link
        href={user ? "/connect" : "/login?next=/connect"}
        className="mt-8 rounded-xl bg-neutral-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-neutral-700"
      >
        Lancer un matching
      </Link>
      <Link
        href="/ecosystem/join"
        className="mt-3 text-sm text-neutral-500 underline underline-offset-2"
      >
        Ou rejoindre l&apos;écosystème en tant que partenaire
      </Link>

      <div className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-semibold text-neutral-900">1. Décris ton projet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Industrie, types de partenaires recherchés, et contexte libre — en 3 étapes.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-semibold text-neutral-900">2. Matching IA</p>
          <p className="mt-1 text-sm text-neutral-500">
            Recherche web en temps réel + répertoire vivant de l&apos;écosystème.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-semibold text-neutral-900">3. Passe à l&apos;action</p>
          <p className="mt-1 text-sm text-neutral-500">
            Brief stratégique, idées concrètes, et contacts directs cliquables.
          </p>
        </div>
      </div>
    </div>
  );
}
