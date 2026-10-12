"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { Icon, type IconName } from "@/components/icons";

// Bottom tab bar on phones: the five sections a client moves between,
// always one tap away, the way native apps do it. Hidden from md upward,
// where the top bar carries the same links, and on public pages (landing,
// sign-in) where there is nothing to switch between yet.
const HIDDEN_ON = ["/", "/login", "/auth", "/ecosystem/join"];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const { t } = useLanguage();

  if (HIDDEN_ON.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)))) return null;

  const tabs: { href: string; label: string; icon: IconName; match: string[] }[] = [
    { href: "/control-tower", label: t.nav.towerShort, icon: "tower", match: ["/control-tower", "/impact"] },
    { href: "/decide", label: t.nav.decide, icon: "decide", match: ["/decide"] },
    { href: "/connect", label: t.nav.connect, icon: "connect", match: ["/connect"] },
    { href: "/learn", label: t.nav.learn, icon: "learn", match: ["/learn"] },
    { href: "/deliver", label: t.nav.deliver, icon: "deliver", match: ["/deliver"] },
  ];

  return (
    <nav
      aria-label={t.nav.mainNavLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match.some((m) => pathname.startsWith(m));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10.5px] font-medium transition ${
                  active ? "text-accent-strong" : "text-muted"
                }`}
              >
                <Icon name={tab.icon} className="h-5 w-5" strokeWidth={active ? 1.9 : 1.6} />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
