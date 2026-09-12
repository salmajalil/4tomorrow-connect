import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getLanguage();
  const t = getDictionary(language);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-4 py-3">
        <Link href="/" className="shrink-0 font-display text-lg tracking-wide text-ink">
          4 TOMORROW
        </Link>
        <nav className="ml-auto flex shrink-0 items-center gap-4 whitespace-nowrap text-sm">
          <Link href="/ecosystem/join" className="text-muted hover:text-ink">
            {t.nav.joinEcosystem}
          </Link>
          {user ? (
            <>
              <Link href="/control-tower" className="font-medium text-ink hover:text-accent">
                {t.nav.controlTower}
              </Link>
              <Link href="/decide" className="font-medium text-ink hover:text-accent">
                {t.nav.decide}
              </Link>
              <Link href="/connect" className="font-medium text-ink hover:text-accent">
                {t.nav.connect}
              </Link>
              <Link href="/learn" className="font-medium text-ink hover:text-accent">
                {t.nav.learn}
              </Link>
              <Link href="/deliver" className="font-medium text-ink hover:text-accent">
                {t.nav.deliver}
              </Link>
              <SignOutButton label={t.nav.signOut} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-ink hover:bg-accent-strong"
            >
              {t.nav.login}
            </Link>
          )}
          <LanguageToggle userId={user?.id ?? null} />
        </nav>
      </div>
    </header>
  );
}
