import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchControlTowerProjects, fetchPendingInvitationCount } from "@/lib/control-tower";
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
  const [projects, pendingInvitations] = await Promise.all([
    fetchControlTowerProjects(supabase, user.id, t.common.untitledProject),
    fetchPendingInvitationCount(supabase, user.email),
  ]);

  return (
    <ControlTowerView
      userId={user.id}
      userEmail={user.email ?? null}
      initialProjects={projects}
      initialPendingInvitations={pendingInvitations}
    />
  );
}
