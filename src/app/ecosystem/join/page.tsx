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
      <h1 className="text-xl font-bold text-neutral-900">Rejoindre l&apos;écosystème</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Ajoute une technologie, une startup, un expert ou un partenaire au répertoire partagé —
        sans validation manuelle, visible immédiatement dans les prochains matchings.
      </p>
      <div className="mt-6">
        <JoinForm />
      </div>
    </div>
  );
}
