import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Instrument_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { LanguageProvider } from "@/components/language-provider";
import { TomorrowChat } from "@/components/assistant/tomorrow-chat";
import { TomorrowProvider } from "@/components/assistant/tomorrow-context";
import { BrandThemeProvider } from "@/components/brand-theme-context";
import { getLanguage } from "@/lib/i18n/language";
import { createClient } from "@/lib/supabase/server";

// The three faces of the printed 4 Tomorrow catalogue: an editorial serif
// for headings, a clean grotesque for text, a mono for labels and figures.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "4 Tomorrow",
  description:
    "4 Tomorrow — l'écosystème opérationnel connecté pour la transformation industrielle : diagnostic, partenaires, formation et exécution, un seul projet suivi de bout en bout.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a08",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const language = await getLanguage();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let initialBrandTheme = null;
  if (user) {
    const { data: org } = await supabase
      .from("organizations")
      .select("brand_theme")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    initialBrandTheme = org?.brand_theme ?? null;
  }

  return (
    <html
      lang={language}
      className={`${instrumentSerif.variable} ${instrumentSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <LanguageProvider initialLanguage={language}>
          <BrandThemeProvider initialTheme={initialBrandTheme}>
            <TomorrowProvider>
              <Nav />
              <main className="flex flex-1 flex-col pb-20 md:pb-0">{children}</main>
              <MobileTabBar />
              <TomorrowChat />
            </TomorrowProvider>
          </BrandThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
