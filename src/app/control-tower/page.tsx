import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchControlTowerProjects } from "@/lib/control-tower";
import { ControlTowerView } from "@/components/control-tower/control-tower-view";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function ControlTowerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/control-tower");
  }

  const language = await getLanguage();
  const t = getDictionary(language);
  const projects = await fetchControlTowerProjects(supabase, user.id, t.common.untitledProject);

  return <ControlTowerView userId={user.id} initialProjects={projects} />;
}
