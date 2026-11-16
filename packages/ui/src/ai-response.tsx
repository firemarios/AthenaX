"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import type { AIAnswer, Meta } from "@policylab/types";
import { useI18n } from "./providers";
import { Badge, Skeleton } from "./primitives";
import { formatLimitation } from "./limitations";

export interface AIResponseProps {
  answer: AIAnswer;
  meta?: Meta | null;
  loading?: boolean;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function AIResponse({ answer, meta, loading = false }: AIResponseProps) {
  const { t } = useI18n();

  const sources = useMemo(() => {
    const seen = new Set<string>();
    const unique: { url: string; title: string }[] = [];
    for (const source of answer.sources ?? []) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      unique.push(source);
    }
    return unique;
  }, [answer.sources]);

  const limitations = answer.limitations ?? [];
  const detail = answer.detailed_result ?? "";
  const detailParagraphs = useMemo(() => paragraphs(detail), [detail]);

  if (loading) {
    return (
      <div
        aria-live="polite"
        className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4"
      >
        <p className="text-sm font-medium text-muted-foreground">
          {t({ el: "Ανάκτηση απάντησης…", en: "Fetching answer…" })}
        </p>
        <Skeleton rows={4} />
      </div>
    );
  }

  return (
    <article className="space-y-4" aria-live="polite">
      <div className="rounded-[var(--radius-card)] border-l-4 border-primary bg-primary/5 p-4">
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-foreground">
          {answer.summary}
        </p>
      </div>

      {detailParagraphs.length > 0 ? (
        <details className="group rounded-[var(--radius-card)] border border-border bg-card">
          <summary className="cursor-pointer list-none rounded-[var(--radius-card)] px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t({ el: "Αναλυτικό αποτέλεσμα", en: "Detailed result" })}
            <span
              aria-hidden="true"
              className="ml-2 text-muted-foreground transition group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="space-y-3 border-t border-border px-4 py-4">
            {detailParagraphs.map((paragraph, index) => (
              <p
                key={index}
                className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {sources.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t({ el: "Πηγές", en: "Sources" })}
          </h3>
          <ul className="space-y-1.5">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{source.title || source.url}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {limitations.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t({ el: "Περιορισμοί", en: "Limitations" })}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`}>
                <Badge tone="warning">{formatLimitation(limitation, t)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {meta?.record_count !== undefined && meta?.record_count !== null ? (
        <p className="text-xs text-muted-foreground">
          {t({ el: "Εγγραφές πηγών:", en: "Source records:" })}{" "}
          {meta.record_count}
        </p>
      ) : null}

      {meta?.ui?.alert ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {meta.ui.alert}
        </p>
      ) : null}
    </article>
  );
}
