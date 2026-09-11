import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConnectFlow } from "./connect-flow";

export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/connect");
  }

  return <ConnectFlow />;
}
