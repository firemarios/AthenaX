"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn, useI18n } from "@policylab/ui";
import { TiltCard } from "../tilt-card";
import { MODULES, MODULE_SECTION } from "../home-content";

export function ModuleGrid() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="modules-heading"
      className="relative border-b border-[var(--home-line)]"
    >
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-24">
        <div
          className="mb-10 flex flex-wrap items-end justify-between gap-4"
          data-reveal
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
              {t(MODULE_SECTION.eyebrow)}
            </p>
            <h2
              id="modules-heading"
              className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--home-ink)] sm:text-4xl"
            >
              {t(MODULE_SECTION.title)}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[var(--home-muted)]">
            {t(MODULE_SECTION.body)}
          </p>
        </div>

        <div
          className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-reveal-group
        >
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            const large = index < 2 || index === MODULES.length - 1;
            return (
              <div
                key={module.href}
                className={cn(
                  "h-full",
                  large ? "sm:col-span-2" : "sm:col-span-1",
                )}
              >
                <TiltCard className="h-full">
                  <Link
                    href={module.href}
                    className={cn(
                      "pl-home-card pl-card-sheen group flex h-full flex-col rounded-3xl transition-colors duration-300 hover:border-[var(--home-accent)]/45",
                      large ? "p-6 sm:p-7" : "p-5",
                    )}
                  >
                    <div className="pl-depth-1 flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex items-center justify-center rounded-2xl bg-[var(--home-accent)]/12 text-[var(--home-accent)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--home-accent)] group-hover:text-white",
                          large ? "h-12 w-12" : "h-11 w-11",
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className={large ? "h-5 w-5" : "h-5 w-5"}
                        />
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4 text-[var(--home-muted)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--home-accent)]"
                      />
                    </div>
                    <div className="pl-depth-1 mt-4">
                      <p
                        className={cn(
                          "font-semibold text-[var(--home-ink)]",
                          large ? "text-lg" : "text-sm",
                        )}
                      >
                        {t(module.title)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--home-muted)]">
                        {t(module.description)}
                      </p>
                      {module.badge ? (
                        <span className="mt-3 inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                          {module.badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="pl-depth-1 mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-[var(--home-accent)]">
                      {t(MODULE_SECTION.open)}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                </TiltCard>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
