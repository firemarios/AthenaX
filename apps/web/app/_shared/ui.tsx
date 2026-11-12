"use client";

import { useI18n } from "@policylab/ui";
import type { Quality } from "@policylab/types";
import { pctValue } from "./format";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

export const inputCls =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export const labelCls =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const cardCls =
  "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5";

export const mutedText = "text-sm text-zinc-600 dark:text-zinc-400";

export const headingCls =
  "text-lg font-semibold text-zinc-900 dark:text-zinc-100";

export function useBi() {
  const { t, lang, setLang } = useI18n();
  function bi(value: string | { el: string; en: string } | null | undefined): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    return t(value);
  }
  return { t, lang, setLang, bi };
}

const STR = {
  retry: { el: "Δοκιμάστε ξανά", en: "Try again" },
  errorTitle: { el: "Κάτι πήγε στραβά", en: "Something went wrong" },
  loading: { el: "Φόρτωση…", en: "Loading…" },
  prev: { el: "Προηγούμενη", en: "Previous" },
  next: { el: "Επόμενη", en: "Next" },
  pageOf: { el: "Σελίδα", en: "Page" },
  of: { el: "από", en: "of" },
  back: { el: "Επιστροφή", en: "Back" },
};

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className={`mt-2 max-w-3xl ${mutedText}`}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4"
    >
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">
        {t(STR.errorTitle)}
      </p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`${btnPrimary} mt-3`}>
          {t(STR.retry)}
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      <span className="sr-only">{t(STR.loading)}</span>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
          style={{ width: `${95 - (i % 4) * 12}%` }}
        />
      ))}
    </div>
  );
}

export function PageFallback({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <LoadingBlock rows={rows} />
    </div>
  );
}

export function SectionCard({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardCls} ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className={headingCls}>{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function QualityBar({ label, value }: { label: string; value: number | null }) {
  const known = value !== null && value !== undefined && Number.isFinite(value);
  const pct = known ? pctValue(value) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-xs text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      <div
        role="progressbar"
        aria-valuenow={known ? pct : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={known ? `${pct}%` : "-"}
        aria-label={label}
        className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
      >
        {known ? (
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
        ) : null}
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {known ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

export function QualityBars({ quality, compact = false }: { quality: Quality; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5">
      <QualityBar label={t({ el: "Πληρότητα", en: "Completeness" })} value={quality.completeness} />
      <QualityBar label={t({ el: "Φρεσκάδα", en: "Freshness" })} value={quality.freshness} />
      {compact ? null : (
        <QualityBar label={t({ el: "Εγκυρότητα", en: "Validity" })} value={quality.validity} />
      )}
    </div>
  );
}

export function validationTone(
  status: Quality["validation_status"] | string | null | undefined
): "neutral" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "valid":
      return "success";
    case "invalid":
      return "error";
    case "warning":
      return "warning";
    case "pending":
      return "neutral";
    default:
      return "neutral";
  }
}

export function KeyValueTable({
  rows,
}: {
  rows: { k: string; v: React.ReactNode }[];
}) {
  return (
    <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {rows.map((row, i) => (
        <div
          key={`${row.k}-${i}`}
          className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4"
        >
          <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{row.k}</dt>
          <dd className="text-sm text-zinc-900 dark:text-zinc-100 sm:col-span-2">{row.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              selected
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="pagination"
      className="mt-6 flex items-center justify-center gap-3"
    >
      <button
        type="button"
        className={btnSecondary}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← {t(STR.prev)}
      </button>
      <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {t(STR.pageOf)} {page} {t(STR.of)} {pageCount}
      </span>
      <button
        type="button"
        className={btnSecondary}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        {t(STR.next)} →
      </button>
    </nav>
  );
}

export function NoticeBox({
  children,
  tone = "info",
  onDismiss,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
  onDismiss?: () => void;
  className?: string;
}) {
  const tones =
    tone === "warning"
      ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
      : "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100";
  return (
    <div className={`relative rounded-xl border p-4 text-sm ${tones} ${className}`}>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-2 top-2 rounded p-1 text-current opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          ✕
        </button>
      ) : null}
      <div className="pr-6">{children}</div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-red-600 dark:text-red-400">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </span>
  );
}
