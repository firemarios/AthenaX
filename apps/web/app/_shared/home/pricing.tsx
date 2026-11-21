"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn, useI18n } from "@athenax/ui";
import { PRICING, PRICING_SECTION } from "../home-content";

export function Pricing() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="pricing-heading"
      className="relative border-b border-[var(--home-line)]"
    >
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20">
        <div
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
          data-reveal
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
              {t(PRICING_SECTION.eyebrow)}
            </p>
            <h2
              id="pricing-heading"
              className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--home-ink)] sm:text-4xl"
            >
              {t(PRICING_SECTION.title)}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--home-muted)]">
            {t(PRICING_SECTION.body)}
          </p>
        </div>

        <div
          className="grid auto-rows-fr gap-4 lg:grid-cols-3"
          data-reveal-group
        >
          {PRICING.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "pl-home-glass-strong relative flex h-full flex-col rounded-3xl p-5 transition-colors duration-300 sm:p-6",
                plan.featured
                  ? "ring-2 ring-[var(--home-accent)]"
                  : "hover:border-[var(--home-accent)]/45",
              )}
            >
              {plan.featured ? (
                <span className="absolute right-4 top-4 rounded-full bg-[var(--home-accent)]/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--home-accent)]">
                  {t(PRICING_SECTION.badge)}
                </span>
              ) : null}

              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-muted)]">
                {t(plan.name)}
              </p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-[-0.03em] text-[var(--home-ink)]">
                  {t(plan.price)}
                </span>
                <span className="text-xs text-[var(--home-muted)]">
                  {t(plan.period)}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--home-muted)]">
                {t(plan.summary)}
              </p>

              <ul className="mt-5 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature.en}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--home-ink)]"
                  >
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--home-accent)]"
                    />
                    <span>{t(feature)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <Link
                  href={plan.href}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]",
                    plan.featured
                      ? "bg-[var(--home-accent-solid)] text-white hover:brightness-110"
                      : "border border-[var(--home-line)] text-[var(--home-ink)] hover:border-[var(--home-accent)]",
                  )}
                >
                  {t(plan.cta)}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--home-muted)]">
          {t(PRICING_SECTION.note)}
        </p>
      </div>
    </section>
  );
}
