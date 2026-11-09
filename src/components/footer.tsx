import Link from "next/link";
import { getLanguage } from "@/lib/i18n/language";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function Footer() {
  const language = await getLanguage();
  const t = getDictionary(language);
  const f = t.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border pb-20 md:pb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted sm:px-8">
        <p>
          © {year} {f.rights}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <Link href="/legal/mentions-legales" className="hover:text-ink">
            {f.mentions}
          </Link>
          <Link href="/legal/confidentialite" className="hover:text-ink">
            {f.confidentialite}
          </Link>
          <Link href="/legal/cgu" className="hover:text-ink">
            {f.cgu}
          </Link>
          <Link href="/account" className="hover:text-ink">
            {f.account}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
