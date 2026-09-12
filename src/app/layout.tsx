import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { LanguageProvider } from "@/components/language-provider";
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
  title: "4 Tomorrow — Connect",
  description:
    "Trouve les partenaires, technologies et experts réels qui adressent les gaps de ta transformation industrielle.",
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
          <Nav />
          <main className="flex flex-1 flex-col">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
