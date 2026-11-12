import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import {
  ErrorBoundary,
  I18nProvider,
  LayoutShell,
  Nav,
  ThemeProvider,
} from "@policylab/ui";

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
  title: "POLICYLAB — Open GovTech Intelligence & Policy Experimentation",
  description:
    "Το POLICYLAB συνδέει δημόσια δεδομένα και GovTech πληροφορίες, σε βάση αποδείξεων. Κατανοείς την πόλη και δοκιμάζεις καλύτερες πολιτικές.",
  keywords: [
    "POLICYLAB",
    "GovTech",
    "open data",
    "δημόσια δεδομένα",
    "πολιτικές",
    "ψηφιακή πόλη",
    "Αθήνα",
  ],
};

const themeInitScript = `(function(){try{var k="policylab_theme";var t=null;try{t=window.localStorage.getItem(k)}catch(e){}if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}var l=null;try{l=window.localStorage.getItem("policylab_lang")}catch(e){}if(l==="el"||l==="en"){document.documentElement.lang=l}}catch(e){}})();`;

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
            <ErrorBoundary>
              <LayoutShell>
                <Suspense fallback={null}>
                  <Nav />
                </Suspense>
                <main id="main-content" className="flex min-w-0 flex-1 flex-col">
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
