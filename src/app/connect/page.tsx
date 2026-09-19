import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/eyebrow";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { ConnectThemeWrap } from "@/components/connect/connect-theme";
import { ConnectFlow } from "./connect-flow";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ transformationId?: string }>;
}) {
  const { transformationId: requestedTransformationId } = await searchParams;
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

  // RLS scopes this to the caller's own row — a foreign or missing id just
  // returns nothing, and the form starts blank as usual.
  let initialIndustry = "";
  let initialDescription = "";
  let transformationId: string | null = null;
  if (requestedTransformationId) {
    const { data: transformation } = await supabase
      .from("transformations")
      .select("id, challenges, organization_id")
      .eq("id", requestedTransformationId)
      .maybeSingle();
    if (transformation) {
      transformationId = transformation.id;
      initialDescription = transformation.challenges ?? "";
      const { data: org } = await supabase
        .from("organizations")
        .select("industry")
        .eq("id", transformation.organization_id)
        .maybeSingle();
      initialIndustry = org?.industry ?? "";
    }
  }

  return (
    <ConnectThemeWrap>
      <div className="mx-auto w-full max-w-2xl px-4 pt-8">
        <Eyebrow>Connect</Eyebrow>
        <h1 className="mt-3 font-display text-2xl text-ink sm:text-3xl">{intro.title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">{intro.subtitle}</p>
      </div>
      <ConnectFlow
        initialIndustry={initialIndustry}
        initialDescription={initialDescription}
        transformationId={transformationId}
      />
    </ConnectThemeWrap>
  );
}
