import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <ConnectThemeWrap>
      <ConnectFlow />
    </ConnectThemeWrap>
  );
}
