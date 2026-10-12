import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { LanguageToggle } from "@/components/language-toggle";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";

// Top bar. On desktop it carries the full navigation; on a phone it keeps
// only the logo, language and account, and the five sections move to the
// bottom tab bar (MobileTabBar) — no more links scrolling off-screen.
export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getLanguage();
  const t = getDictionary(language);

  const links = [
    { href: "/control-tower", label: t.nav.controlTower },
    { href: "/decide", label: t.nav.decide },
    { href: "/connect", label: t.nav.connect },
    { href: "/learn", label: t.nav.learn },
    { href: "/deliver", label: t.nav.deliver },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-8">
        <Link href={user ? "/control-tower" : "/"} className="shrink-0" aria-label="4 Tomorrow">
          <Image src="/brand/4tomorrow-logo.png" alt="4 Tomorrow Strategy" width={140} height={35} priority className="h-8 w-auto" />
        </Link>

        {user && (
          <nav aria-label={t.nav.mainNavLabel} className="hidden items-center gap-6 text-sm md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-body transition hover:text-accent-strong">
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-4 text-sm">
          <Link href="/ecosystem/join" className="hidden text-muted hover:text-ink lg:inline">
            {t.nav.joinEcosystem}
          </Link>
          <LanguageToggle userId={user?.id ?? null} />
          {user ? (
            <SignOutButton label={t.nav.signOut} />
          ) : (
            <Link href="/login" className="bg-accent px-3.5 py-2 font-medium text-accent-ink hover:bg-accent-strong">
              {t.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
