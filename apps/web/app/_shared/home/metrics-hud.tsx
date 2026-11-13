"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp, useI18n } from "@policylab/ui";
import { METRICS_SECTION } from "../home-content";
import type { HomeMetrics } from "./use-home-metrics";
import { healthLabel } from "./use-home-metrics";

function healthTone(health: string | null): string {
  if (health === "ok") return "text-emerald-500 dark:text-emerald-400";
  if (health === "degraded") return "text-amber-600 dark:text-amber-400";
  if (health === "down") return "text-rose-600 dark:text-rose-400";
  return "text-[var(--home-muted)]";
}

function healthDot(health: string | null): string {
  if (health === "ok") return "bg-emerald-500";
  if (health === "degraded") return "bg-amber-500";
  if (health === "down") return "bg-rose-500";
  return "bg-slate-400";
}

export function MetricsHud({
  metrics,
  loading,
  failed,
  retry,
}: {
  metrics: HomeMetrics | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
}) {
  const { t } = useI18n();
  const cards = METRICS_SECTION.cards;

  const cells: { label: string; hint: string; value: ReactNode }[] = [
    {
      label: t(cards.sources.label),
      hint: t(cards.sources.hint),
      value: loading ? "…" : <CountUp value={metrics?.sources ?? null} />,
    },
    {
      label: t(cards.datasets.label),
      hint: t(cards.datasets.hint),
      value: loading ? "…" : <CountUp value={metrics?.datasets ?? null} />,
    },
    {
      label: t(cards.connectors.label),
      hint: t(cards.connectors.hint),
      value: loading ? "…" : <CountUp value={metrics?.connectors ?? null} />,
    },
    {
      label: t(cards.health.label),
      hint: t(cards.health.hint),
      value: loading ? (
        "…"
      ) : (
        <span
          className={`inline-flex items-center gap-2 ${healthTone(metrics?.health ?? null)}`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${healthDot(metrics?.health ?? null)}`}
          />
          {healthLabel(metrics?.health ?? null, t)}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="metrics-heading"
      className="relative border-b border-[var(--home-line)]"
    >
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 sm:py-20">
        <div
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
          data-reveal
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--home-accent)]">
              {t(METRICS_SECTION.eyebrow)}
            </p>
            <h2
              id="metrics-heading"
              className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--home-ink)] sm:text-4xl"
            >
              {t(METRICS_SECTION.title)}
            </h2>
          </div>
          <button
            type="button"
            onClick={retry}
            className="pl-home-chip inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:text-[var(--home-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)]"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {t(METRICS_SECTION.refresh)}
          </button>
        </div>

        {failed && !loading ? (
          <p
            role="alert"
            className="mb-5 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-700/70 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {t(METRICS_SECTION.failure)}
          </p>
        ) : null}

        <div
          className="pl-home-hud grid gap-px overflow-hidden rounded-3xl border border-[var(--home-line)] bg-[var(--home-line)] sm:grid-cols-2 lg:grid-cols-4"
          data-reveal-group
        >
          {cells.map((cell, index) => (
            <div
              key={cell.label}
              className="relative bg-[var(--home-card)] p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--home-muted)]">
                  {String(index + 1).padStart(2, "0")} · {cell.label}
                </p>
                <span
                  aria-hidden="true"
                  className="h-1 w-6 rounded-full bg-[var(--home-accent)]/25"
                />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-[var(--home-ink)]">
                {cell.value}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--home-muted)]">
                {cell.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
