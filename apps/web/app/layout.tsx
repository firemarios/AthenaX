import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import {
  ErrorBoundary,
  I18nProvider,
  LayoutShell,
  Nav,
  RouteFocus,
  ScrollProgress,
  ScrollReveal,
  ThemeProvider,
} from "@athenax/ui";
import { SiteLoader } from "./_shared/site-loader";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "ATHENAX",
  title: "ATHENAX — Wisdom Meets the Future",
  description:
    "Το ATHENAX συνδέει δημόσια δεδομένα και GovTech πληροφορίες, σε βάση αποδείξεων. Κατανοείς την πόλη και δοκιμάζεις καλύτερα σενάρια.",
  keywords: [
    "ATHENAX",
    "GovTech",
    "open data",
    "δημόσια δεδομένα",
    "σενάρια",
    "ψηφιακή πόλη",
    "Αθήνα",
  ],
  openGraph: {
    title: "ATHENAX — Wisdom Meets the Future",
    description:
      "Open data, GovTech intelligence and scenario experimentation with provenance and evidence in every answer.",
    siteName: "ATHENAX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ATHENAX — Wisdom Meets the Future",
    description:
      "Open data, GovTech intelligence and scenario experimentation with provenance and evidence in every answer.",
  },
};

const themeInitScript = `(function(){try{var k="athenax_theme";var t=null;try{t=window.localStorage.getItem(k)}catch(e){}if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}document.documentElement.classList.add("js");setTimeout(function(){document.documentElement.classList.add("reveal-fallback")},3000);var l=null;try{l=window.localStorage.getItem("athenax_lang")}catch(e){}if(l==="el"||l==="en"){document.documentElement.lang=l}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <I18nProvider>
            <SiteLoader />
            <ErrorBoundary>
              <ScrollProgress />
              <LayoutShell>
                <ScrollReveal />
                <Suspense fallback={null}>
                  <Nav />
                </Suspense>
                <Suspense fallback={null}>
                  <RouteFocus />
                </Suspense>
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="flex min-w-0 flex-1 flex-col pb-24 outline-none md:pb-0"
                >
                  {children}
                </main>
              </LayoutShell>
            </ErrorBoundary>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
