import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { ConnectThemeWrap } from "@/components/connect/connect-theme";
import { ConnectFlow } from "./connect-flow";

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/connect");
  }

  const language = await getLanguage();
  const t = getDictionary(language);
  const intro = t.connect.intro;

  return (
    <ConnectThemeWrap>
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        <Eyebrow>Connect</Eyebrow>
        <h1 className="mt-3 font-display text-2xl text-ink sm:text-3xl">{intro.title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">{intro.subtitle}</p>
      </div>
      <ConnectFlow />
    </ConnectThemeWrap>
  );
}
