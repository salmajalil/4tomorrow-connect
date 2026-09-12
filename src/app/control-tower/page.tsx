import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchControlTowerProjects } from "@/lib/control-tower";
import { ControlTowerView } from "@/components/control-tower/control-tower-view";

export default async function ControlTowerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/control-tower");
  }

  const projects = await fetchControlTowerProjects(supabase, user.id);

  return <ControlTowerView userId={user.id} initialProjects={projects} />;
}
