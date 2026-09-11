import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DecideFlow } from "./decide-flow";

export default async function DecidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/decide");
  }

  return <DecideFlow />;
}
