"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@athenax/ui";
import { CHAPTERS, HOME_ARIA, WHO } from "../home-content";
import { HeroContent } from "./hero-content";
import { HeroPoster } from "./hero-poster";

export function StackedHome({
  onSearch,
  health,
  loading,
}: {
  onSearch: (query: string) => void;
  health: string | null;
  loading: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="pl-home-stacked">
      <section
        aria-label={t(HOME_ARIA.hero)}
        className="relative overflow-hidden border-b border-[var(--home-line)]"
      >
        <div
          aria-hidden="true"
          className="pl-home-grid pointer-events-none absolute inset-0 opacity-70"
        />
        <div className="relative mx-auto grid w-full max-w-[96rem] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] lg:items-center">
          <HeroContent onSearch={onSearch} />
          <HeroPoster health={health} loading={loading} />
        </div>
      </section>

      <section
        aria-labelledby="who-heading"
        className="relative mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div data-reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
              {t(WHO.eyebrow)}
            </p>
            <h2
              id="who-heading"
              className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-[var(--home-ink)] sm:text-4xl"
            >
              {t(WHO.title)}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--home-muted)]">
              {t(WHO.body)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3" data-reveal-group>
            {WHO.pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title.en}
                  className="pl-home-card pl-lift group rounded-3xl p-5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--home-accent)]/12 text-[var(--home-accent)] transition-transform duration-300 group-hover:scale-110">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-[var(--home-ink)]">
                    {t(pillar.title)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--home-muted)]">
                    {t(pillar.body)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="chapters-heading"
        className="relative border-y border-[var(--home-line)] bg-[var(--home-bg-deep)]"
      >
        <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 max-w-2xl" data-reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
              S.02
            </p>
            <h2
              id="chapters-heading"
              className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[var(--home-ink)] sm:text-4xl"
            >
              {t({
                el: "Τέσσερα κεφάλαια, μία διαδρομή.",
                en: "Four chapters, one journey.",
              })}
            </h2>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2" data-reveal-group>
            {CHAPTERS.map((chapter) => (
              <li
                key={chapter.id}
                className="pl-home-card pl-lift flex flex-col rounded-3xl p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--home-muted)]">
                    {chapter.id} · {t(chapter.tag)}
                  </span>
                  <span className="font-mono text-3xl font-semibold leading-none text-[var(--home-accent)]/30">
                    {chapter.number}
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.015em] text-[var(--home-ink)]">
                  {t(chapter.title)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--home-muted)]">
                  {t(chapter.body)}
                </p>
                <Link href={chapter.href} className="pl-home-link mt-5">
                  {t(chapter.linkLabel)}
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
