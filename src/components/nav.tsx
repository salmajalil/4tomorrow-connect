import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-lg tracking-wide text-ink">
          4 TOMORROW <span className="font-sans text-sm font-normal text-accent">/ Connect</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ecosystem/join" className="text-muted hover:text-ink">
            Rejoindre l&apos;écosystème
          </Link>
          {user ? (
            <>
              <Link href="/connect" className="font-medium text-ink hover:text-accent">
                Lancer un matching
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink hover:bg-accent-strong"
            >
              Se connecter
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
