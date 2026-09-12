import Link from "next/link";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // The "touch of black" against the site's beige body: a self-contained
    // dark strip using the original dark-theme token values, scoped locally
    // via CSS custom properties (same mechanism as Learn's own theme wrap)
    // — every class below (bg-bg, text-ink, text-accent, ...) still reads
    // through these, so nothing else needs to change.
    <header
      className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur"
      style={
        {
          "--bg": "#14110d",
          "--surface": "#1c1811",
          "--surface-2": "#241f16",
          "--border": "#332b1c",
          "--ink": "#f3ead8",
          "--muted": "#a89a7c",
          "--accent": "#c9a256",
          "--accent-strong": "#e0bd6e",
          "--accent-ink": "#14110d",
        } as CSSProperties
      }
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-3">
        <Link href="/" className="shrink-0 font-display text-lg tracking-wide text-ink">
          4 TOMORROW
        </Link>
        <nav className="ml-auto flex shrink-0 items-center gap-4 whitespace-nowrap text-sm">
          <Link href="/ecosystem/join" className="text-muted hover:text-ink">
            Rejoindre l&apos;écosystème
          </Link>
          {user ? (
            <>
              <Link href="/control-tower" className="font-medium text-ink hover:text-accent">
                Tour de contrôle
              </Link>
              <Link href="/decide" className="font-medium text-ink hover:text-accent">
                Decide
              </Link>
              <Link href="/connect" className="font-medium text-ink hover:text-accent">
                Connect
              </Link>
              <Link href="/learn" className="font-medium text-ink hover:text-accent">
                Learn
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
