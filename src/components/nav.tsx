import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-bold tracking-tight text-neutral-900">
          4 Tomorrow <span className="font-normal text-neutral-400">/ Connect</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ecosystem/join" className="text-neutral-600 hover:text-neutral-900">
            Rejoindre l&apos;écosystème
          </Link>
          {user ? (
            <>
              <Link href="/connect" className="font-medium text-neutral-900">
                Lancer un matching
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700"
            >
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
