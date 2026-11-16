"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@athenax/ui";
import { FINALE, FOOTER } from "../home-content";

export function Finale() {
  const { t } = useI18n();

  return (
    <>
      <section className="mx-auto w-full max-w-[96rem] px-4 pb-16 pt-4 sm:px-6 sm:pb-24">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0b0b] px-6 py-12 text-white shadow-[0_40px_120px_-40px_rgba(0,82,255,0.45)] sm:px-10 sm:py-14"
          data-reveal="scale"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="pl-aurora left-[-10%] top-[-40%] h-[360px] w-[360px] bg-[#0052ff]/40" />
            <div className="pl-aurora bottom-[-60%] right-[-5%] h-[360px] w-[360px] bg-[#22d3ee]/30 [animation-delay:-8s]" />
            <div className="pl-home-grain absolute inset-0" />
          </div>

          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">
                {t(FINALE.eyebrow)}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
                {t(FINALE.title)}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                {t(FINALE.body)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/ask"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#06164f] transition-all duration-200 hover:-translate-y-px hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {t(FINALE.primary)}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="/simulations"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-px hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {t(FINALE.secondary)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--home-line)]">
        <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-2 px-4 py-8 text-sm text-[var(--home-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2 font-semibold tracking-[0.16em] text-[var(--home-ink)]">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#0052ff] to-[#22d3ee]"
            />
            ATHENAX
          </p>
          <p>{t(FOOTER.license)}</p>
          <p>{t(FOOTER.promise)}</p>
        </div>
      </footer>
    </>
  );
}
