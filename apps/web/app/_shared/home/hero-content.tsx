"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn, ExampleChips, SearchBar, useI18n } from "@athenax/ui";
import { EXAMPLE_QUESTIONS, HERO } from "../home-content";

export function HeroContent({
  onSearch,
  variant = "stacked",
}: {
  onSearch: (query: string) => void;
  variant?: "pinned" | "stacked";
}) {
  const { t } = useI18n();
  const pinned = variant === "pinned";

  return (
    <div className="min-w-0">
      {pinned ? (
        <div
          className="pl-enter flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--home-muted)] sm:text-[10px] sm:tracking-[0.24em]"
          style={{ animationDelay: "0ms" }}
        >
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--home-cyan)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--home-cyan)]" />
          </span>
          {t(HERO.liveValue)}
        </div>
      ) : (
        <span className="pl-home-chip pl-home-eyebrow inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[var(--home-cyan)]"
          />
          {t(HERO.eyebrow)}
        </span>
      )}

      <h1
        className={cn(
          "pl-enter max-w-[20ch] text-balance font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--home-ink)]",
          pinned
            ? "mt-3 text-[clamp(2.15rem,5.2vw,3.9rem)] sm:mt-4"
            : "mt-4 text-[clamp(1.95rem,4.2vw,3.45rem)] sm:mt-6",
        )}
        style={{ animationDelay: "80ms" }}
      >
        {t(HERO.lead)}{" "}
        <span className="pl-gradient-text mt-1 block">{t(HERO.accent)}</span>
      </h1>

      <p
        className="pl-enter mt-3 max-w-lg text-pretty text-[13px] leading-relaxed text-[var(--home-muted)] sm:mt-5 sm:text-base"
        style={{ animationDelay: "160ms" }}
      >
        {t(HERO.body)}
      </p>

      <div
        className="pl-enter pl-home-search mt-4 max-w-xl sm:mt-7"
        style={{ animationDelay: "240ms" }}
      >
        <SearchBar onSearch={onSearch} />
      </div>

      {!pinned ? (
        <div
          className="pl-enter mt-4 max-w-2xl"
          style={{ animationDelay: "320ms" }}
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--home-muted)]">
            {t(HERO.tryLabel)}
          </p>
          <ExampleChips
            items={EXAMPLE_QUESTIONS.slice(0, 3)}
            onPick={onSearch}
          />
        </div>
      ) : null}

      <div
        className={cn(
          "pl-enter mt-4 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3",
          pinned && "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3",
        )}
        style={{ animationDelay: "400ms" }}
      >
        <Link
          href="/policies/new"
          className="pl-home-cta-primary justify-center sm:justify-start"
        >
          {t(HERO.ctaPrimary)}
          <ArrowRight
            aria-hidden="true"
            className="hidden h-4 w-4 sm:block"
          />
        </Link>
        <Link
          href="/ask"
          className="pl-home-cta-ghost justify-center sm:justify-start"
        >
          {t(HERO.ctaSecondary)}
        </Link>
      </div>
    </div>
  );
}
