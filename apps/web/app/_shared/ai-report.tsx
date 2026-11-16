"use client";

import { Badge, StatCard, useI18n } from "@athenax/ui";
import type {
  AIReportBlock,
  AIReportKpi,
  AIReportSection,
  AISimulationPlan,
} from "@athenax/types";
import { AIPlanPanel, AIChart } from "./charts";
import { fmtConfidence, fmtNum } from "./format";
import { mutedText } from "./ui";

function kpiValue(item: AIReportKpi, lang: "el" | "en"): string {
  const value = typeof item.value === "number" ? fmtNum(item.value, lang) : item.value;
  return item.unit ? `${value} ${item.unit}` : value;
}

function Block({ block }: { block: AIReportBlock }) {
  const { t, lang } = useI18n();

  if (block.kind === "kpis") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item, index) => (
          <div
            key={`${item.label.en}-${index}`}
            className={
              item.tone === "positive"
                ? "rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                : item.tone === "negative"
                  ? "rounded-[var(--radius-card)] border border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                  : ""
            }
          >
            <StatCard
              label={t(item.label)}
              value={kpiValue(item, lang)}
              hint={item.hint ? t(item.hint) : undefined}
            />
          </div>
        ))}
      </div>
    );
  }

  if (block.kind === "chart") {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h4 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t(block.chart.title)}
        </h4>
        <AIChart chart={block.chart} />
      </div>
    );
  }

  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {block.table.title ? (
          <h4 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
            {t(block.table.title)}
          </h4>
        ) : null}
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              {block.table.columns.map((column, index) => (
                <th
                  key={`${column.en}-${index}`}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  {t(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {block.table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-2 text-zinc-800 dark:text-zinc-200"
                  >
                    {typeof cell === "number" ? fmtNum(cell, lang) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.kind === "text") {
    return (
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {t(block.text)}
      </p>
    );
  }

  const isRisk = block.kind === "risks";
  return (
    <div>
      <h4
        className={
          isRisk
            ? "mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300"
            : "mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        }
      >
        {isRisk
          ? t({ el: "Κίνδυνοι", en: "Risks" })
          : t({ el: "Βασικά ευρήματα", en: "Key findings" })}
      </h4>
      <ul
        className={
          isRisk
            ? "list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300"
            : "list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200"
        }
      >
        {block.items.map((item, index) => (
          <li key={index}>{t(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function Section({ section }: { section: AIReportSection }) {
  const { t } = useI18n();
  return (
    <section className="space-y-4 border-t border-zinc-200 pt-5 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t(section.title)}
        </h3>
        {section.description ? (
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t(section.description)}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">
        {section.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>
    </section>
  );
}

export function AIReportView({
  ai,
  modelLabel,
}: {
  ai: AISimulationPlan;
  modelLabel?: string;
}) {
  const { t, lang } = useI18n();
  const sections = ai.sections ?? [];
  if (sections.length === 0) return <AIPlanPanel ai={ai} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ai.ai_used ? "success" : "warning"}>
          {ai.ai_used
            ? t({ el: "Σύνθεση από AI", en: "AI-composed" })
            : t({ el: "Εφεδρική εκτίμηση", en: "Fallback estimate" })}
        </Badge>
        {modelLabel ? <Badge tone="info">{modelLabel}</Badge> : null}
        <Badge tone="neutral">
          {t({ el: "Βεβαιότητα", en: "Confidence" })}: {fmtConfidence(ai.confidence)}
        </Badge>
      </div>

      {ai.model_reason ? (
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t(ai.model_reason)}
        </p>
      ) : null}

      {sections.map((section, index) => (
        <Section key={`${section.title.en}-${index}`} section={section} />
      ))}

      {ai.metrics && ai.metrics.length > 0 ? (
        <section className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {t({ el: "Πρόσθετοι δείκτες", en: "Additional indicators" })}
            </h3>
            <Badge tone="info">{t({ el: "Εκτίμηση AI", en: "AI estimate" })}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ai.metrics.map((metric) => (
              <StatCard
                key={metric.key}
                label={t(metric.label)}
                value={`${fmtNum(metric.value, lang)}${metric.unit ? ` ${metric.unit}` : ""}`}
                hint={
                  metric.baseline !== null && metric.baseline !== undefined
                    ? `${t({ el: "Βάση", en: "Baseline" })}: ${fmtNum(metric.baseline, lang)}`
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {ai.assumptions.length > 0 ? (
        <section className="space-y-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Παραδοχές AI", en: "AI assumptions" })}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {ai.assumptions.map((item, index) => (
              <li key={index}>{t(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {ai.limitations.length > 0 ? (
        <p className={mutedText}>
          {t({ el: "Περιορισμοί", en: "Limitations" })}: {ai.limitations.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
