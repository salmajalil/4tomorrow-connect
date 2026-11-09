import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Eyebrow } from "@/components/eyebrow";
import { DeleteAccountButton } from "@/components/delete-account-button";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const language = await getLanguage();
  const t = getDictionary(language);
  const a = t.account;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <Eyebrow>{a.title}</Eyebrow>
      <h1 className="mt-3 font-display text-2xl text-ink sm:text-3xl">{a.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {a.signedInAs} <span className="font-medium text-ink">{user.email}</span>
      </p>

      <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="font-display text-lg text-danger">{a.dangerZoneTitle}</h2>
        <p className="text-sm text-muted">{a.deleteAccountHint}</p>
        <DeleteAccountButton t={t} />
      </div>
    </div>
  );
}
