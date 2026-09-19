import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { LanguageProvider } from "@/components/language-provider";
import { TomorrowChat } from "@/components/assistant/tomorrow-chat";
import { TomorrowProvider } from "@/components/assistant/tomorrow-context";
import { getLanguage } from "@/lib/i18n/language";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings — elegant editorial serif, matching the
// official 4 Tomorrow brand deck ("From Complexity to Action.").
const playfair = Playfair_Display({
  variable: "--font-playfair",
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
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const language = await getLanguage();
  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <LanguageProvider initialLanguage={language}>
          <TomorrowProvider>
            <Nav />
            <main className="flex flex-1 flex-col">{children}</main>
            <TomorrowChat />
          </TomorrowProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
