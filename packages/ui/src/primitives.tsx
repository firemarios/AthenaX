"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Download, ExternalLink } from "lucide-react";
import type { Source } from "@policylab/types";
import { useI18n } from "./providers";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral:
    "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  error:
    "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200",
  info: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        BADGE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}

export interface DataCardProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  sourceUrl?: string;
  footer?: ReactNode;
  onClick?: () => void;
}

export function DataCard({
  title,
  subtitle,
  badge,
  meta,
  sourceUrl,
  footer,
  onClick,
}: DataCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-card p-4 text-left shadow-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        onClick &&
          "cursor-pointer hover:border-primary/50 hover:shadow-md active:translate-y-px",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
          {title}
        </h3>
        {badge ? <span className="max-w-[45%] shrink-0">{badge}</span> : null}
      </div>
      {subtitle ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
      {meta ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {meta}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            Πηγή
          </a>
        ) : (
          <span />
        )}
        {footer}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  suggestions,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  suggestions?: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border bg-card px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4 6h16M4 12h10M4 18h7" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {suggestions && suggestions.length > 0 ? (
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {suggestions.map((item) => (
            <li
              key={item}
              className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  const widths = ["60%", "92%", "78%", "85%", "70%"];
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-3", className)}
      data-testid="skeleton"
    >
      {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-muted"
          style={{ width: widths[index % widths.length] }}
        />
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<
  Source["status"],
  { el: string; en: string; dot: string }
> = {
  healthy: { el: "Υγιής", en: "Healthy", dot: "bg-emerald-500" },
  degraded: { el: "Μειωμένος", en: "Degraded", dot: "bg-amber-500" },
  down: { el: "Εκτός λειτουργίας", en: "Down", dot: "bg-rose-500" },
  unknown: { el: "Άγνωστος", en: "Unknown", dot: "bg-zinc-400" },
};

export function ConnectorStatusChip({
  status,
  detail,
}: {
  status: Source["status"];
  detail?: string;
}) {
  const { t } = useI18n();
  const config = STATUS_LABELS[status] ?? STATUS_LABELS.unknown;
  const label = t(config);
  return (
    <span
      title={detail ?? label}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
    >
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 rounded-full", config.dot)}
      />
      {label}
      {detail ? <span className="sr-only">{detail}</span> : null}
    </span>
  );
}

export function FilterPanel({
  children,
  defaultOpen = true,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-card)] px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t({ el: "Φίλτρα", en: "Filters" })}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">{children}</div>
      ) : null}
    </section>
  );
}

export type ExportFormat = "csv" | "geojson" | "json";

export function ExportButton({
  onExport,
}: {
  onExport: (format: ExportFormat) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (format: ExportFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-[var(--radius-button)] border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        {t({ el: "Εξαγωγή", en: "Export" })}
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-lg"
        >
          {(["csv", "geojson", "json"] as ExportFormat[]).map((format) => (
            <li key={format} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => pick(format)}
                className="w-full px-3 py-2 text-left text-sm capitalize text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {format}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ExampleChips({
  items,
  onPick,
}: {
  items: string[];
  onPick: (q: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="rounded-full border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
