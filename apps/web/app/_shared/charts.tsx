"use client";

import { useEffect, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Badge, StatCard, useI18n } from "@athenax/ui";
import type {
  AIReportChart,
  AISimulationPlan,
  EconomicsVerdict,
  PolicyEconomics,
  PracticalityFactorStatus,
  PracticalityVerdict,
} from "@athenax/types";
import { fmtConfidence, fmtEUR, fmtNum } from "./format";
import { mutedText } from "./ui";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

const PALETTE = ["#007aff", "#34c759", "#ff9f0a", "#ff3b30", "#5ac8fa", "#af52de"];
const CHART_FONT = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const AXIS_TICK = "#71717a";
const GRID_LINE = "rgba(113, 113, 122, 0.18)";

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(24, 24, 27, 0.94)",
  titleFont: { family: CHART_FONT, size: 12 },
  bodyFont: { family: CHART_FONT, size: 12 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
} as const;

const TICKS = { color: AXIS_TICK, font: { family: CHART_FONT, size: 11 } } as const;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function barOptions(
  reduced: boolean,
  format: (value: number) => string,
  horizontal = false
): ChartOptions<"bar"> {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: GRID_LINE },
    border: { display: false },
    ticks: {
      ...TICKS,
      callback: (value: string | number) => format(Number(value)),
    },
  };
  const categoryAxis = {
    grid: { display: false },
    border: { display: false },
    ticks: TICKS,
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    animation: reduced
      ? false
      : { duration: 850, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          label: (context) => format(Number(context.raw)),
        },
      },
    },
    scales: horizontal
      ? { x: valueAxis, y: categoryAxis }
      : { x: categoryAxis, y: valueAxis },
  };
}

const METRIC_LABELS: Record<string, { el: string; en: string }> = {
  green_m2_per_capita: { el: "Πράσινο ανά κάτοικο", en: "Green m² per capita" },
  pct_within_300m: { el: "Πρόσβαση σε πράσινο 300 μ.", en: "Green access within 300 m" },
  green_area_m2: { el: "Συνολικό πράσινο", en: "Total green area" },
  accessibility_pct: { el: "Προσβασιμότητα με τα πόδια", en: "Walk accessibility" },
  covered_population: { el: "Πληθυσμός που εξυπηρετείται", en: "Population served" },
  facilities_count: { el: "Εγκαταστάσεις", en: "Facilities" },
  avg_travel_min: { el: "Μέσος χρόνος μετακίνησης", en: "Average travel time" },
  throughput_vph: { el: "Διέλευση οχημάτων", en: "Vehicle throughput" },
  queue_length_m: { el: "Ουρά αναμονής", en: "Queue length" },
  emissions_kg: { el: "Εκπομπές", en: "Emissions" },
  noise_db: { el: "Θόρυβος", en: "Noise" },
  cost_eur: { el: "Κόστος", en: "Cost" },
  cost_low_eur: { el: "Κόστος (χαμηλό)", en: "Cost (low)" },
  cost_high_eur: { el: "Κόστος (υψηλό)", en: "Cost (high)" },
};

const FINANCIAL_TONE: Record<EconomicsVerdict, "success" | "warning" | "error" | "neutral"> = {
  yes: "success",
  marginal: "warning",
  no: "error",
  unknown: "neutral",
};

const FINANCIAL_LABEL: Record<EconomicsVerdict, { el: string; en: string }> = {
  yes: { el: "Συμφέρει οικονομικά", en: "Financially sound" },
  marginal: { el: "Οριακά", en: "Borderline" },
  no: { el: "Δεν συμφέρει", en: "Not financially sound" },
  unknown: { el: "Ανεπαρκή στοιχεία", en: "Not enough data" },
};

const PRACTICALITY_TONE: Record<PracticalityVerdict, "success" | "warning" | "error" | "neutral"> = {
  practical: "success",
  cautious: "warning",
  difficult: "error",
  unknown: "neutral",
};

const PRACTICALITY_LABEL: Record<PracticalityVerdict, { el: string; en: string }> = {
  practical: { el: "Εφαρμόσιμο", en: "Practical" },
  cautious: { el: "Με επιφυλάξεις", en: "With caveats" },
  difficult: { el: "Δύσκολο στην πράξη", en: "Hard to deliver" },
  unknown: { el: "Ανεπαρκή στοιχεία", en: "Not enough data" },
};

const FACTOR_TONE: Record<PracticalityFactorStatus, "success" | "warning" | "error" | "neutral"> = {
  ok: "success",
  warn: "warning",
  bad: "error",
  unknown: "neutral",
};

const FACTOR_STATUS_LABEL: Record<PracticalityFactorStatus, { el: string; en: string }> = {
  ok: { el: "Εντάξει", en: "OK" },
  warn: { el: "Επιφύλαξη", en: "Caveat" },
  bad: { el: "Εμπόδιο", en: "Blocker" },
  unknown: { el: "Άγνωστο", en: "Unknown" },
};

export function metricLabel(key: string): { el: string; en: string } {
  return METRIC_LABELS[key] ?? { el: key, en: key };
}

export function MetricComparisonChart({
  metrics,
  baseline,
}: {
  metrics: Record<string, number>;
  baseline: Record<string, number>;
}) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const keys = Object.keys(metrics);
  if (keys.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((key, index) => {
        const value = metrics[key];
        const base = baseline[key];
        const hasBase = typeof base === "number" && Number.isFinite(base);
        const data: ChartData<"bar"> = {
          labels: [
            t({ el: "Σενάριο", en: "Scenario" }),
            t({ el: "Βάση", en: "Baseline" }),
          ].slice(0, hasBase ? 2 : 1),
          datasets: [
            {
              label: t(metricLabel(key)),
              data: hasBase ? [value, base] : [value],
              backgroundColor: hasBase ? [PALETTE[0], "#a1a1aa"] : [PALETTE[0]],
              borderRadius: 6,
              maxBarThickness: 46,
            },
          ],
        };
        return (
          <div
            key={key}
            className="pl-reveal rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t(metricLabel(key))}
              </p>
              <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {t({ el: "Σενάριο", en: "Scenario" })}: {fmtNum(value, lang)}
              </p>
            </div>
            <div
              className="h-36"
              role="img"
              aria-label={`${t(metricLabel(key))}: ${fmtNum(value, lang)}`}
            >
              <Bar data={data} options={barOptions(reduced, (v) => fmtNum(v, lang))} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatAIValue(
  value: number,
  format: AIReportChart["format"],
  unit: string | undefined,
  lang: "el" | "en"
): string {
  if (format === "currency") return fmtEUR(value, lang);
  if (format === "percent") return `${fmtNum(value, lang)}%`;
  const text = fmtNum(value, lang);
  return unit ? `${text} ${unit}` : text;
}

export function AIChart({ chart }: { chart: AIReportChart }) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const labels = chart.labels.map((label) => t(label));
  const datasets = chart.datasets.filter((dataset) => dataset.data.length > 0);
  if (labels.length === 0 || datasets.length === 0) return null;

  const formatter = (value: number) => formatAIValue(value, chart.format, chart.unit, lang);
  const palette = PALETTE;
  const label = t(chart.title);

  if (chart.type === "donut") {
    const data: ChartData<"doughnut"> = {
      labels,
      datasets: [
        {
          data: datasets[0].data.slice(0, labels.length),
          backgroundColor: labels.map(
            (_, index) => datasets[0].color ?? palette[index % palette.length]
          ),
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
    const options: ChartOptions<"doughnut"> = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: reduced ? false : { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_STYLE,
          callbacks: { label: (context) => `${context.label}: ${formatter(Number(context.raw))}` },
        },
      },
    };
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-52 w-52 shrink-0" role="img" aria-label={label}>
          <Doughnut data={data} options={options} />
        </div>
        <ul className="w-full space-y-2">
          {labels.slice(0, datasets[0].data.length).map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: datasets[0].color ?? palette[index % palette.length] }}
                />
                <span className="truncate">{item}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatter(datasets[0].data[index] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (chart.type === "line") {
    const data: ChartData<"line"> = {
      labels,
      datasets: datasets.map((dataset, index) => ({
        label: t(dataset.label),
        data: dataset.data.slice(0, labels.length),
        borderColor: dataset.color ?? palette[index % palette.length],
        backgroundColor: dataset.color ?? palette[index % palette.length],
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: false,
      })),
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: reduced ? false : { duration: 850, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: {
          ...TOOLTIP_STYLE,
          callbacks: { label: (context) => `${context.dataset.label}: ${formatter(Number(context.raw))}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: TICKS },
        y: {
          beginAtZero: true,
          grid: { color: GRID_LINE },
          border: { display: false },
          ticks: { ...TICKS, callback: (value: string | number) => formatter(Number(value)) },
        },
      },
    };
    return (
      <div className="h-64" role="img" aria-label={label}>
        <Line data={data} options={options} />
      </div>
    );
  }

  const data: ChartData<"bar"> = {
    labels,
    datasets: datasets.map((dataset, index) => ({
      label: t(dataset.label),
      data: dataset.data.slice(0, labels.length),
      backgroundColor: dataset.color ?? palette[index % palette.length],
      borderRadius: 6,
      maxBarThickness: 46,
    })),
  };
  return (
    <div className="h-64" role="img" aria-label={label}>
      <Bar data={data} options={barOptions(reduced, formatter, chart.horizontal)} />
    </div>
  );
}

function LineList({
  lines,
  empty,
}: {
  lines: { label: { el: string; en: string }; amount_eur: number }[];
  empty: string;
}) {
  const { t, lang } = useI18n();
  if (lines.length === 0) return <p className={mutedText}>{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {lines.map((line, index) => (
        <li key={`${line.label.en}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">{t(line.label)}</span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {fmtEUR(line.amount_eur, lang)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  ariaLabel,
}: {
  segments: { label: { el: string; en: string }; value: number }[];
  centerLabel: { el: string; en: string };
  centerValue: string;
  ariaLabel: { el: string; en: string };
}) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const visible = segments.filter((segment) => Number.isFinite(segment.value) && segment.value > 0);

  if (visible.length === 0) {
    return <p className={mutedText}>{t({ el: "Δεν υπάρχουν δεδομένα.", en: "No data available." })}</p>;
  }

  const data: ChartData<"doughnut"> = {
    labels: visible.map((segment) => t(segment.label)),
    datasets: [
      {
        data: visible.map((segment) => segment.value),
        backgroundColor: visible.map((_, index) => PALETTE[index % PALETTE.length]),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    animation: reduced
      ? false
      : { animateRotate: true, animateScale: true, duration: 950, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          label: (context) => `${context.label}: ${fmtEUR(Number(context.raw), lang)}`,
        },
      },
    },
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div
        className="relative h-44 w-44 shrink-0"
        role="img"
        aria-label={t(ariaLabel)}
      >
        <Doughnut data={data} options={options} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t(centerLabel)}</span>
          <span className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {centerValue}
          </span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {visible.map((segment, index) => (
          <li
            key={`${segment.label.en}-legend-${index}`}
            className="pl-reveal flex items-center justify-between gap-3 text-sm"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[index % PALETTE.length] }}
              />
              <span className="truncate">{t(segment.label)}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {fmtNum(segment.value, lang)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIPlanPanel({ ai }: { ai: AISimulationPlan }) {
  const { t, lang } = useI18n();
  const factors = ai.factors.filter((factor) => {
    if (factor.value === null || factor.value === undefined || factor.value === "") return false;
    return Number.isNaN(Number(factor.value)) || Number(factor.value) !== 0;
  });
  const hasTax =
    ai.tax.annual_tax_revenue_eur !== null &&
    (Number(ai.tax.annual_tax_revenue_eur) > 0 ||
      Number(ai.tax.new_buildings) > 0 ||
      Number(ai.tax.tax_change_pct) !== 0);
  return (
    <div className="space-y-5">
      <div className="pl-reveal flex flex-wrap items-center gap-2">
        <Badge tone={ai.ai_used ? "success" : "warning"}>
          {ai.ai_used
            ? t({ el: "Υπολογισμένο από AI", en: "AI-calculated" })
            : t({ el: "Εφεδρική εκτίμηση", en: "Fallback estimate" })}
        </Badge>
        <Badge tone="info">{ai.model}</Badge>
        <Badge tone="neutral">
          {t({ el: "Βεβαιότητα", en: "Confidence" })}: {fmtConfidence(ai.confidence)}
        </Badge>
      </div>

      <p className="pl-reveal text-sm leading-relaxed text-zinc-800 dark:text-zinc-200" style={{ animationDelay: "80ms" }}>
        {t(ai.report.summary)}
      </p>

      {factors.length > 0 ? (
        <div className="pl-reveal" style={{ animationDelay: "160ms" }}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Παράγοντες που υπολόγισε το AI", en: "Factors calculated by AI" })}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {factors.map((factor, index) => (
              <li
                key={factor.name}
                className="pl-reveal rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                style={{ animationDelay: `${220 + index * 70}ms` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {factor.label ? t(factor.label) : factor.name}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                    {String(factor.value ?? "—")}{factor.unit ? ` ${factor.unit}` : ""}
                  </p>
                </div>
                {factor.reason && (factor.reason.el || factor.reason.en) ? (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t(factor.reason)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasTax ? (
        <div className="pl-reveal grid gap-3 sm:grid-cols-3" style={{ animationDelay: "420ms" }}>
          <StatCard
            label={t({ el: "Νέα κτίρια", en: "New buildings" })}
            value={fmtNum(ai.tax.new_buildings, lang)}
          />
          <StatCard
            label={t({ el: "Ετήσια φορολογικά έσοδα", en: "Annual tax revenue" })}
            value={fmtEUR(ai.tax.annual_tax_revenue_eur, lang)}
          />
          <StatCard
            label={t({ el: "Μεταβολή φόρου", en: "Tax change" })}
            value={`${fmtNum(ai.tax.tax_change_pct, lang)}%`}
          />
        </div>
      ) : null}

      {ai.report.findings.length > 0 ? (
        <div className="pl-reveal" style={{ animationDelay: "520ms" }}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Βασικά ευρήματα", en: "Key findings" })}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
            {ai.report.findings.map((item, index) => (
              <li
                key={index}
                className="pl-reveal"
                style={{ animationDelay: `${580 + index * 70}ms` }}
              >
                {t(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ai.report.risks.length > 0 ? (
        <div className="pl-reveal" style={{ animationDelay: "760ms" }}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Κίνδυνοι", en: "Risks" })}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
            {ai.report.risks.map((item, index) => (
              <li
                key={index}
                className="pl-reveal"
                style={{ animationDelay: `${820 + index * 70}ms` }}
              >
                {t(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function EconomicsPanel({ economics }: { economics: PolicyEconomics }) {
  const { t, lang } = useI18n();
  const reduced = useReducedMotion();
  const financialVerdict = economics.financial?.verdict ?? economics.verdict;
  const practicality = economics.practicality;

  const comparisonData: ChartData<"bar"> = {
    labels: [
      t({ el: "Κεφαλαιουχικό κόστος", en: "Capex" }),
      t({ el: "Ετήσιο όφελος", en: "Annual benefit" }),
      t({ el: "Ετησιοποιημένο κόστος", en: "Annualised cost" }),
    ],
    datasets: [
      {
        data: [economics.capex_eur, economics.annual_benefit_eur, economics.annualized_cost_eur],
        backgroundColor: [PALETTE[0], PALETTE[1], "#a1a1aa"],
        borderRadius: 6,
        maxBarThickness: 30,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t({ el: "Απαιτούμενο κεφαλαιουχικό κόστος", en: "Required capex" })}
          value={fmtEUR(economics.capex_eur, lang)}
          hint={`${fmtEUR(economics.capex_low_eur, lang)} – ${fmtEUR(economics.capex_high_eur, lang)}`}
        />
        <StatCard
          label={t({ el: "Ετήσιο όφελος", en: "Annual benefit" })}
          value={fmtEUR(economics.annual_benefit_eur, lang)}
          hint={
            economics.benefit_source === "ai"
              ? t({ el: "Εκτίμηση AI", en: "AI estimate" })
              : economics.benefit_source === "heuristic"
                ? t({ el: "Εκτίμηση σεναρίου", en: "Scenario estimate" })
                : `${t({ el: "Ετησιοποιημένο κόστος", en: "Annualised cost" })}: ${fmtEUR(economics.annualized_cost_eur, lang)}`
          }
        />
        <StatCard
          label={t({ el: "Όφελος / κόστος", en: "Benefit / cost" })}
          value={economics.benefit_cost_ratio !== null ? `${fmtNum(economics.benefit_cost_ratio, lang)}×` : "—"}
          hint={
            economics.payback_years !== null
              ? `${t({ el: "Αποπληρωμή", en: "Payback" })}: ${fmtNum(economics.payback_years, lang)} ${t({ el: "έτη", en: "years" })}`
              : undefined
          }
        />
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t({ el: "Αξίζει;", en: "Worth it?" })}
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t({ el: "Οικονομικά", en: "Financially" })}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={FINANCIAL_TONE[financialVerdict]}>
                  {t(FINANCIAL_LABEL[financialVerdict])}
                </Badge>
                {economics.financial?.payback_years !== null &&
                economics.financial?.payback_years !== undefined ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t({ el: "Αποπληρωμή", en: "Payback" })}:{" "}
                    {fmtNum(economics.financial.payback_years, lang)}{" "}
                    {t({ el: "έτη", en: "years" })}
                  </span>
                ) : null}
              </div>
              {economics.financial ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(economics.financial.summary)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t({ el: "Στην πράξη", en: "In practice" })}
              </p>
              {practicality ? (
                <>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={PRACTICALITY_TONE[practicality.verdict]}>
                      {t(PRACTICALITY_LABEL[practicality.verdict])}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtNum(practicality.score, lang)}/100
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(practicality.summary)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t({
                    el: "Δεν υπάρχει ακόμη εκτίμηση πρακτικότητας.",
                    en: "No practicality estimate yet.",
                  })}
                </p>
              )}
            </div>
          </div>
          {economics.within_budget !== null ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {economics.within_budget
                ? t({ el: "Εντός προϋπολογισμού", en: "Within budget" })
                : t({ el: "Υπέρβαση προϋπολογισμού", en: "Over budget" })}
            </p>
          ) : null}
        </div>
      </div>

      {practicality && practicality.factors.length > 0 ? (
        <div className="pl-reveal rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Τι καθορίζει την πρακτικότητα", en: "What drives practicality" })}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {practicality.factors.map((factor) => (
              <li
                key={factor.key}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {t(factor.label)}
                  </span>
                  <Badge tone={FACTOR_TONE[factor.status]}>
                    {t(FACTOR_STATUS_LABEL[factor.status])}
                  </Badge>
                </div>
                <p className={`mt-1 text-xs ${mutedText}`}>{t(factor.note)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="pl-reveal rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Σύνθεση ετήσιου οφέλους", en: "Annual benefit mix" })}
          </h3>
          <DonutChart
            segments={economics.benefit_breakdown.map((line) => ({
              label: line.label,
              value: line.amount_eur,
            }))}
            centerLabel={{ el: "Ετήσιο όφελος", en: "Annual benefit" }}
            centerValue={fmtEUR(economics.annual_benefit_eur, lang)}
            ariaLabel={{ el: "Γράφημα σύνθεσης οφέλους", en: "Benefit mix chart" }}
          />
        </div>
        <div className="pl-reveal rounded-lg border border-zinc-200 p-4 dark:border-zinc-800" style={{ animationDelay: "120ms" }}>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Σύνθεση κόστους", en: "Cost mix" })}
          </h3>
          <DonutChart
            segments={economics.cost_breakdown.map((line) => ({
              label: line.label,
              value: line.amount_eur,
            }))}
            centerLabel={{ el: "Κεφαλαιουχικό κόστος", en: "Capex" }}
            centerValue={fmtEUR(economics.capex_eur, lang)}
            ariaLabel={{ el: "Γράφημα σύνθεσης κόστους", en: "Cost mix chart" }}
          />
        </div>
      </div>

      <div
        className="pl-reveal rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        role="img"
        aria-label={t({ el: "Γράφημα κόστους και οφέλους", en: "Cost and benefit chart" })}
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t({ el: "Κόστος & όφελος", en: "Cost & benefit" })}
        </h3>
        <div className="h-52">
          <Bar data={comparisonData} options={barOptions(reduced, (v) => fmtEUR(v, lang), true)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Κόστος", en: "Cost" })}
          </h3>
          <LineList
            lines={economics.cost_breakdown}
            empty={t({ el: "Δεν υπολογίστηκε κόστος.", en: "No cost estimate available." })}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t({ el: "Οφέλη", en: "Benefits" })}
          </h3>
          <LineList
            lines={economics.benefit_breakdown}
            empty={t({ el: "Δεν υπολογίστηκε όφελος.", en: "No benefit estimate available." })}
          />
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        {t(economics.summary)}
      </p>
    </div>
  );
}
