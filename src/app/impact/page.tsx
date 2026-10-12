import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";
import { fetchProjectImpact } from "@/lib/project-impact";
import { ImpactView } from "@/components/impact/impact-view";

// Per-project results page: the verdict first, then the key indicators with
// their confidence level, the module-by-module journey, risks and next
// steps — the screen a client sees at the end of a use case, and the entry
// point to the CEO and detailed reports.
export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ transformationId?: string }>;
}) {
  const { transformationId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/impact${transformationId ? `?transformationId=${transformationId}` : ""}`)}`);
  }

  const language = await getLanguage();
  const t = getDictionary(language);

  if (!transformationId) {
    redirect("/control-tower");
  }

  const project = await fetchProjectImpact(supabase, transformationId, t.common.untitledProject);

  if (!project) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-muted">{t.impact.notFound}</p>
        <Link href="/control-tower" className="mt-6 inline-block text-sm font-semibold text-accent underline underline-offset-4">
          {t.impact.backToTower}
        </Link>
      </div>
    );
  }

  return <ImpactView project={project} t={t} language={language} />;
}
