import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { JoinForm } from "./join-form";

export default async function JoinEcosystemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/ecosystem/join");
  }

  const language = await getLanguage();
  const t = getDictionary(language);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="font-display text-3xl text-ink">{t.ecosystemJoin.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.ecosystemJoin.subtitle}</p>
      <div className="mt-6">
        <JoinForm />
      </div>
    </div>
  );
}
