import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export default async function JoinEcosystemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/ecosystem/join");
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="font-display text-3xl tracking-wide text-ink">Rejoindre l&apos;écosystème</h1>
      <p className="mt-1 text-sm text-muted">
        Ajoute une technologie, une startup, un expert, un partenaire ou un programme de
        financement au répertoire partagé — sans validation manuelle, visible immédiatement dans
        les prochains matchings.
      </p>
      <div className="mt-6">
        <JoinForm />
      </div>
    </div>
  );
}
