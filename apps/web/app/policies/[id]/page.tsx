"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, DataCard, Skeleton, cn, useI18n } from "@policylab/ui";
import type {
  ModelSpec,
  Policy,
  PolicyFactor,
  PolicyVariant,
  SimulationRun,
} from "@policylab/types";
import { doPost, useApi } from "@/_shared/hooks";
import { fmtDate, fmtEUR } from "@/_shared/format";
import { areaName, type CityArea } from "@/_shared/geo";
import { KeyValueEditor, rowsToKv, type KvRow } from "@/_shared/forms";
import { EconomicsPanel } from "@/_shared/charts";
import {
  HORIZON_OPTIONS,
  POLICY_STATUS_LABELS,
  categoryLabel,
  statusLabel,
  statusTone,
} from "@/_shared/terms";
import {
  ErrorPanel,
  Field,
  KeyValueTable,
  PageFallback,
  PageHeader,
  SectionCard,
  Tag,
  btnPrimary,
  inputCls,
  labelCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  back: { el: "← Πίσω στις πολιτικές", en: "← Back to policies" },
  elements: { el: "Στοιχεία", en: "Details" },
  factors: { el: "Μεταβαλλόμενοι παράγοντες", en: "Changing factors" },
  changes: { el: "Αλλαγές πολιτικής", en: "Policy changes" },
  parameters: { el: "Παράμετροι", en: "Parameters" },
  budget: { el: "Προϋπολογισμός", en: "Budget" },
  simulationArea: { el: "Περιοχή προσομοίωσης", en: "Simulation location" },
  economics: { el: "Κόστος & αξία", en: "Cost & value" },
  economicsNone: {
    el: "Εκτελέστε μια προσομοίωση για να υπολογιστεί κόστος, όφελος και αν αξίζει.",
    en: "Run a simulation to calculate cost, benefit and value for money.",
  },
  assumptions: { el: "Υποθέσεις", en: "Assumptions" },
  kpis: { el: "Δείκτες απόδοσης", en: "Performance indicators" },
  variants: { el: "Παραλλαγές πολιτικής", en: "Policy variants" },
  newVariant: { el: "Νέα παραλλαγή", en: "New variant" },
  variantTitle: { el: "Τίτλος παραλλαγής", en: "Variant title" },
  variantTitlePh: { el: "π.χ. Εναλλακτική με υψηλότερη συχνότητα", en: "e.g. Alternative with higher frequency" },
  variantRequired: { el: "Γράψτε έναν τίτλο για την παραλλαγή.", en: "Enter a title for the variant." },
  addVariant: { el: "Δημιουργία παραλλαγής", en: "Create variant" },
  keyLabel: { el: "Κλειδί", en: "Key" },
  valueLabel: { el: "Τιμή", en: "Value" },
  addParam: { el: "Προσθήκη παραμέτρου", en: "Add parameter" },
  remove: { el: "Αφαίρεση", en: "Remove" },
  noVariants: { el: "Δεν υπάρχουν παραλλαγές ακόμη.", en: "No variants yet." },
  simulation: { el: "Προσομοίωση", en: "Simulation" },
  aiSimulation: { el: "Προσομοίωση με AI", en: "AI simulation" },
  aiDesc: {
    el: "Το AI διαβάζει το θέμα, το ελεύθερο κείμενο και τους παράγοντες, υπολογίζει τις παραμέτρους του μοντέλου και τα φορολογικά έσοδα από τα νέα κτίρια.",
    en: "The AI reads the topic, free text and factors, then calculates the model parameters and property-tax revenue from new buildings.",
  },
  aiRun: { el: "Εκτέλεση με AI", en: "Run with AI" },
  aiRunning: { el: "Το AI υπολογίζει…", en: "AI is calculating…" },
  aiWait: {
    el: "Η ανάλυση μπορεί να διαρκέσει 30–90 δευτερόλεπτα. Μην κλείσετε τη σελίδα.",
    en: "Analysis can take 30–90 seconds. Please keep this page open.",
  },
  runs: { el: "Ιστορικό προσομοιώσεων", en: "Simulation history" },
  runsDesc: {
    el: "Όλες οι εκτελέσεις για αυτή την πολιτική, με τα πιο πρόσφατα πρώτα. Ανοίξτε μία για πλήρη αποτελέσματα.",
    en: "Every run for this policy, newest first. Open one for the full results.",
  },
  noRuns: { el: "Δεν έχουν εκτελεστεί προσομοιώσεις ακόμη.", en: "No simulations have been run yet." },
  openRun: { el: "Άνοιγμα", en: "Open" },
  aiBadge: { el: "AI", en: "AI" },
  manual: { el: "Χειροκίνητη προσομοίωση (για ειδικούς)", en: "Manual simulation (advanced)" },
  simDesc: {
    el: "Επιλέξτε ένα μοντέλο, ρυθμίστε τις παραμέτρους του και εκτελέστε την προσομοίωση.",
    en: "Pick a model, tune its parameters and run the simulation.",
  },
  models: { el: "Διαθέσιμα μοντέλα", en: "Available models" },
  noModels: { el: "Δεν βρέθηκαν μοντέλα προσομοίωσης.", en: "No simulation models found." },
  selectModel: { el: "Επιλογή μοντέλου", en: "Select model" },
  modelParams: { el: "Παράμετροι μοντέλου", en: "Model parameters" },
  compareBaseline: { el: "Σύγκριση με βασικό σενάριο", en: "Compare with baseline scenario" },
  run: { el: "Εκτέλεση προσομοίωσης", en: "Run simulation" },
  running: { el: "Εκτέλεση…", en: "Running…" },
  chooseModelFirst: {
    el: "Επιλέξτε πρώτα ένα μοντέλο.",
    en: "Select a model first.",
  },
  impact: { el: "Επιπτώσεις", en: "Impact" },
  impactLink: { el: "Αναφορά επιπτώσεων →", en: "Impact report →" },
  impactNone: {
    el: "Δεν υπάρχει ακόμη εκτελεσμένη προσομοίωση με αναφορά επιπτώσεων.",
    en: "No completed simulation with an impact report yet.",
  },
  loading: { el: "Φόρτωση πολιτικής…", en: "Loading policy…" },
  notFound: { el: "Η πολιτική δεν βρέθηκε.", en: "The policy was not found." },
  none: { el: "—", en: "—" },
  emptyList: { el: "Καμία καταχώρηση.", en: "No entries." },
  created: { el: "Δημιουργήθηκε", en: "Created" },
  area: { el: "Περιοχή", en: "Area" },
  citywide: { el: "Ολόκληρη η πόλη", en: "City-wide" },
  horizon: { el: "Ορίζοντας", en: "Horizon" },
  category: { el: "Κατηγορία", en: "Category" },
  status: { el: "Κατάσταση", en: "Status" },
  variantParams: { el: "Παράμετροι παραλλαγής", en: "Variant parameters" },
  minMax: { el: "Εύρος", en: "Range" },
  default: { el: "Προεπιλογή", en: "Default" },
};

type Choice = string | number;

const RUN_STATUS_LABELS: Record<string, { el: string; en: string }> = {
  succeeded: { el: "Ολοκληρώθηκε", en: "Succeeded" },
  running: { el: "Σε εξέλιξη", en: "Running" },
  queued: { el: "Σε αναμονή", en: "Queued" },
  failed: { el: "Απέτυχε", en: "Failed" },
};

function paramChoices(p: ModelSpec["parameters"][number]): Choice[] | null {
  const raw = (p as { choices?: unknown }).choices;
  if (Array.isArray(raw) && raw.length > 0) return raw as Choice[];
  return null;
}

function ParameterField({
  spec,
  value,
  onChange,
  factor,
}: {
  spec: ModelSpec["parameters"][number];
  value: string;
  onChange: (next: string) => void;
  factor?: PolicyFactor;
}) {
  const { t, lang } = useI18n();
  const id = `model-param-${spec.name}`;
  const label = factor?.label ? factor.label : t(spec.label);
  const choices = paramChoices(spec);
  const min = factor?.min ?? spec.min;
  const max = factor?.max ?? spec.max;
  const hintParts: string[] = [];
  if (min !== undefined && max !== undefined) {
    hintParts.push(`${t(STR.minMax)}: ${min} – ${max}`);
  }
  if (spec.default !== undefined && spec.default !== null) {
    hintParts.push(`${t(STR.default)}: ${String(spec.default)}`);
  }
  if (factor?.unit) {
    hintParts.push(factor.unit);
  }
  const hint = hintParts.join(" · ");

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
          ({spec.type})
        </span>
      </label>
      {choices ? (
        <select
          id={id}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {choices.map((choice) => (
            <option key={String(choice)} value={String(choice)}>
              {String(choice)}
            </option>
          ))}
        </select>
      ) : spec.type === "range" ? (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="range"
            min={min ?? 0}
            max={max ?? 100}
            step={factor?.step ?? 1}
            className="w-full accent-indigo-600"
            value={Number.isFinite(Number(value)) ? Number(value) : (min ?? 0)}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
          />
          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
            {value || "—"}
          </span>
        </div>
      ) : spec.type === "number" || spec.type === "int" || spec.type === "float" ? (
        <input
          id={id}
          type="number"
          className={inputCls}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {hint} · {lang === "el" ? "π.χ." : "e.g."} {String(spec.default ?? min ?? "—")}
        </p>
      ) : null}
    </div>
  );
}

function PolicyDetailView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const policy = useApi<Policy>(id ? `/v1/policies/${encodeURIComponent(id)}` : null);
  const models = useApi<ModelSpec[]>("/v1/models");
  const areas = useApi<CityArea[]>("/v1/city/areas");
  const runs = useApi<SimulationRun[]>(
    id ? `/v1/simulations?policy_id=${encodeURIComponent(id)}` : null
  );

  const [variantTitle, setVariantTitle] = useState("");
  const [variantParams, setVariantParams] = useState<KvRow[]>([]);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);

  const [selectedModel, setSelectedModel] = useState<ModelSpec | null>(null);
  const [modelValues, setModelValues] = useState<Record<string, string>>({});
  const [areaChoice, setAreaChoice] = useState("");
  const [compareBaseline, setCompareBaseline] = useState(true);
  const [simError, setSimError] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const data = policy.data;

  const factorsByName = new Map(
    (policy.data?.factors ?? []).map((factor) => [factor.name, factor])
  );

  const selectModel = (model: ModelSpec) => {
    setSelectedModel(model);
    setSimError(null);
    const initial: Record<string, string> = {};
    for (const p of model.parameters) {
      const factor = factorsByName.get(p.name);
      initial[p.name] =
        factor !== undefined
          ? String(factor.baseline)
          : p.default === undefined || p.default === null
            ? ""
            : String(p.default);
    }
    setModelValues(initial);
  };

  const handleVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const title = variantTitle.trim();
    if (!title) {
      setVariantError(t(STR.variantRequired));
      return;
    }
    setVariantError(null);
    setVariantBusy(true);
    const res = await doPost<PolicyVariant>(
      `/v1/policies/${encodeURIComponent(id)}/variants`,
      { title, parameters: rowsToKv(variantParams) }
    );
    setVariantBusy(false);
    if (res.error || !res.data) {
      setVariantError(res.error ?? t({ el: "Αποτυχία δημιουργίας παραλλαγής.", en: "Failed to create the variant." }));
      return;
    }
    setVariantTitle("");
    setVariantParams([]);
    policy.reload();
  };

  const handleAiRun = async () => {
    if (!id) return;
    setAiError(null);
    const parameters = Object.fromEntries(
      (policy.data?.factors ?? []).map((factor) => [factor.name, factor.baseline])
    );
    const body: Record<string, unknown> = {
      policy_id: id,
      parameters,
      compare_baseline: true,
      use_ai: true,
    };
    if (policy.data?.changes) body.changes = policy.data.changes;
    const chosenArea = areaChoice
      ? (areas.data ?? []).find((area) => area.id === areaChoice)
      : undefined;
    if (chosenArea) body.area = areaName(chosenArea, lang);
    else if (policy.data?.area) body.area = policy.data.area;
    if (policy.data?.budget_eur !== undefined && policy.data.budget_eur !== null) {
      body.budget_eur = policy.data.budget_eur;
    }
    setAiBusy(true);
    const res = await doPost<SimulationRun>("/v1/simulations", body);
    setAiBusy(false);
    if (res.error || !res.data) {
      setAiError(
        res.error ?? t({ el: "Η προσομοίωση AI απέτυχε.", en: "The AI simulation failed." })
      );
      return;
    }
    router.push(`/simulations/${res.data.id}`);
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModel) {
      setSimError(t(STR.chooseModelFirst));
      return;
    }
    setSimError(null);
    const parameters: Record<string, unknown> = {};
    for (const p of selectedModel.parameters) {
      if (p.name === "area_id") continue;
      const raw = modelValues[p.name] ?? "";
      const choices = paramChoices(p);
      if (p.type === "number" || p.type === "range") {
        const n = Number(raw);
        parameters[p.name] = Number.isFinite(n) ? n : (p.default ?? 0);
      } else if (choices) {
        const match = choices.find((c) => String(c) === raw);
        parameters[p.name] = match !== undefined ? match : raw;
      } else {
        parameters[p.name] = raw;
      }
    }
    setSimBusy(true);
    const body: Record<string, unknown> = {
      model: selectedModel.name,
      parameters,
      compare_baseline: compareBaseline,
    };
    if (id) body.policy_id = id;
    const chosenArea = areaChoice
      ? (areas.data ?? []).find((area) => area.id === areaChoice)
      : undefined;
    if (chosenArea) body.area = areaName(chosenArea, lang);
    else if (data?.area) body.area = data.area;
    if (data?.budget_eur !== undefined && data.budget_eur !== null) {
      body.budget_eur = data.budget_eur;
    }
    const res = await doPost<SimulationRun>("/v1/simulations", body);
    setSimBusy(false);
    if (res.error || !res.data) {
      setSimError(
        res.error ?? t({ el: "Η προσομοίωση απέτυχε.", en: "The simulation failed." })
      );
      return;
    }
    router.push(`/simulations/${res.data.id}`);
  };

  const succeededRuns = (runs.data ?? []).filter((r) => r.status === "succeeded");
  const latestRun = succeededRuns[0] ?? null;
  const latestEconomics = latestRun?.results?.economics ?? null;

  if (policy.loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(STR.loading)}</span>
        <Skeleton rows={8} />
      </div>
    );
  }

  if (policy.error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <ErrorPanel
          message={policy.error ?? t(STR.notFound)}
          onRetry={policy.reload}
        />
        <p className="mt-4">
          <Link
            href="/policies"
            className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {t(STR.back)}
          </Link>
        </p>
      </div>
    );
  }

  const cat = categoryLabel(data.category);
  const horizonOpt = HORIZON_OPTIONS.find((h) => h.value === data.horizon);
  const paramEntries = Object.entries(data.parameters ?? {});
  const policyFactors = data.factors ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={data.title}
        description={data.description ?? undefined}
        actions={
          <>
            <Badge tone={statusTone(data.status)}>
              {t(statusLabel(data.status, POLICY_STATUS_LABELS))}
            </Badge>
            <Badge tone="info">{cat ? t(cat) : data.category}</Badge>
          </>
        }
      />
      <p className="mb-6">
        <Link
          href="/policies"
          className="rounded font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {t(STR.back)}
        </Link>
      </p>

      <div className="space-y-6">
        <SectionCard title={t(STR.elements)}>
          <KeyValueTable
            rows={[
              { k: t(STR.category), v: cat ? t(cat) : t(STR.none) },
              {
                k: t(STR.status),
                v: (
                  <Badge tone={statusTone(data.status)}>
                    {t(statusLabel(data.status, POLICY_STATUS_LABELS))}
                  </Badge>
                ),
              },
              { k: t(STR.area), v: data.area || t(STR.citywide) },
              {
                k: t(STR.budget),
                v:
                  data.budget_eur !== undefined && data.budget_eur !== null
                    ? fmtEUR(data.budget_eur, lang)
                    : t(STR.none),
              },
              { k: t(STR.horizon), v: horizonOpt ? t(horizonOpt.label) : (data.horizon ?? t(STR.none)) },
              { k: t(STR.created), v: fmtDate(data.created_at, lang) },
            ]}
          />
        </SectionCard>

        <SectionCard title={t(STR.factors)}>
          {policyFactors.length === 0 ? (
            <p className={mutedText}>{t(STR.emptyList)}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {policyFactors.map((factor) => (
                <li
                  key={factor.name}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {factor.label || factor.name}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                    {factor.baseline}
                    {factor.unit ? ` ${factor.unit}` : ""} · {factor.min} – {factor.max}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(STR.parameters)}>
          {paramEntries.length === 0 ? (
            <p className={mutedText}>{t(STR.emptyList)}</p>
          ) : (
            <KeyValueTable
              rows={paramEntries.map(([key, value]) => ({
                k: key,
                v:
                  value !== null && typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value),
              }))}
            />
          )}
        </SectionCard>

        {data.changes ? (
          <SectionCard title={t(STR.changes)}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {data.changes}
            </p>
          </SectionCard>
        ) : null}

        <SectionCard title={t(STR.assumptions)}>
          {data.assumptions && data.assumptions.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
              {data.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className={mutedText}>{t(STR.emptyList)}</p>
          )}
        </SectionCard>

        <SectionCard title={t(STR.kpis)}>
          {data.kpis && data.kpis.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
              {data.kpis.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          ) : (
            <p className={mutedText}>{t(STR.emptyList)}</p>
          )}
        </SectionCard>

        <SectionCard title={t(STR.variants)}>
          {data.variants && data.variants.length > 0 ? (
            <ul className="mb-4 space-y-2">
              {data.variants.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {v.title}
                  </p>
                  {Object.keys(v.parameters ?? {}).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(v.parameters).map(([k, val]) => (
                        <Tag key={k}>
                          {k}: {String(val)}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-1 ${mutedText}`}>{t(STR.emptyList)}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mb-4 ${mutedText}`}>{t(STR.noVariants)}</p>
          )}

          <form onSubmit={handleVariant} className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              + {t(STR.newVariant)}
            </h3>
            {variantError ? (
              <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
                {variantError}
              </p>
            ) : null}
            <Field label={t(STR.variantTitle)} htmlFor="variant-title" required>
              <input
                id="variant-title"
                className={inputCls}
                value={variantTitle}
                placeholder={t(STR.variantTitlePh)}
                onChange={(e) => setVariantTitle(e.target.value)}
              />
            </Field>
            <div>
              <h4 className={`mb-2 ${labelCls}`}>{t(STR.variantParams)}</h4>
              <KeyValueEditor
                idPrefix="variant-param"
                rows={variantParams}
                onChange={setVariantParams}
                keyLabel={t(STR.keyLabel)}
                valueLabel={t(STR.valueLabel)}
                addLabel={t(STR.addParam)}
                removeLabel={t(STR.remove)}
              />
            </div>
            <button type="submit" className={btnPrimary} disabled={variantBusy}>
              {variantBusy ? t({ el: "Αποθήκευση…", en: "Saving…" }) : t(STR.addVariant)}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t(STR.aiSimulation)}>
          <p className={`mb-4 ${mutedText}`}>{t(STR.aiDesc)}</p>
          {aiError ? (
            <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {aiError}
            </div>
          ) : null}
          <div className="mb-4">
            <label htmlFor="ai-simulation-area" className={labelCls}>
              {t(STR.simulationArea)}
            </label>
            <select
              id="ai-simulation-area"
              className={inputCls}
              value={areaChoice}
              onChange={(e) => setAreaChoice(e.target.value)}
            >
              <option value="">{data.area || t(STR.citywide)}</option>
              {(areas.data ?? []).map((area) => (
                <option key={area.id} value={area.id}>
                  {areaName(area, lang)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={btnPrimary} onClick={handleAiRun} disabled={aiBusy}>
            {aiBusy ? t(STR.aiRunning) : `✦ ${t(STR.aiRun)}`}
          </button>

          {aiBusy ? (
            <div
              role="status"
              aria-live="polite"
              className="pl-reveal mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-800 dark:bg-indigo-950/30"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" style={{ animationDelay: "0.18s" }} />
                  <span className="pl-ai-dot h-2 w-2 rounded-full bg-indigo-500" style={{ animationDelay: "0.36s" }} />
                </span>
                {t(STR.aiRunning)}
              </div>
              <p className="mt-1 text-xs text-indigo-700/80 dark:text-indigo-300/80">{t(STR.aiWait)}</p>
              <div className="mt-3 space-y-2" aria-hidden="true">
                <div className="pl-ai-shimmer h-2.5 w-full rounded-full" />
                <div className="pl-ai-shimmer h-2.5 w-4/5 rounded-full" style={{ animationDelay: "0.15s" }} />
                <div className="pl-ai-shimmer h-2.5 w-3/5 rounded-full" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title={t(STR.runs)}>
          <p className={`mb-4 ${mutedText}`}>{t(STR.runsDesc)}</p>
          {runs.loading ? (
            <Skeleton rows={3} />
          ) : runs.error ? (
            <ErrorPanel message={runs.error} onRetry={runs.reload} />
          ) : (runs.data ?? []).length === 0 ? (
            <p className={mutedText}>{t(STR.noRuns)}</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(runs.data ?? []).map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/simulations/${run.id}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-zinc-900"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(run.status)}>
                          {t(statusLabel(run.status, RUN_STATUS_LABELS))}
                        </Badge>
                        {run.results?.ai?.ai_used ? (
                          <Badge tone="info">{t(STR.aiBadge)}</Badge>
                        ) : null}
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {run.model_name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {fmtDate(run.created_at, lang)} ·{" "}
                        <span className="font-mono">{run.id.slice(0, 12)}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-indigo-600 transition-transform group-hover:translate-x-0.5 dark:text-indigo-400">
                      {t(STR.openRun)} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(STR.manual)}>
          <p className={`mb-4 ${mutedText}`}>{t(STR.simDesc)}</p>

          {models.loading ? (
            <Skeleton rows={4} />
          ) : models.error ? (
            <ErrorPanel message={models.error} onRetry={models.reload} />
          ) : (models.data ?? []).length === 0 ? (
            <p className={mutedText}>{t(STR.noModels)}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {(models.data ?? []).map((model) => {
                const active = selectedModel?.name === model.name;
                return (
                  <li key={model.name}>
                    <DataCard
                      title={`${model.name} v${model.version}`}
                      subtitle={t(model.description)}
                      badge={<Badge tone="info">{model.category}</Badge>}
                      meta={
                        <span>
                          {model.parameters.length}{" "}
                          {t({ el: "παράμετροι", en: "parameters" })}
                        </span>
                      }
                      onClick={() => selectModel(model)}
                    />
                    <span
                      className={cn(
                        "sr-only",
                        active && "text-indigo-600"
                      )}
                      aria-live="polite"
                    >
                      {active ? t(STR.selectModel) : ""}
                    </span>
                    {active ? (
                      <p className="mt-1 text-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        ✓ {t(STR.selectModel)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {selectedModel ? (
            <form onSubmit={handleRun} className="mt-6 space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t(STR.modelParams)} — {selectedModel.name}
              </h3>
              {simError ? (
                <div role="alert" className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
                  {simError}
                </div>
              ) : null}
              <div>
                <label htmlFor="simulation-area" className={labelCls}>
                  {t(STR.simulationArea)}
                </label>
                <select
                  id="simulation-area"
                  className={inputCls}
                  value={areaChoice}
                  onChange={(e) => setAreaChoice(e.target.value)}
                >
                  <option value="">{data.area || t(STR.citywide)}</option>
                  {(areas.data ?? []).map((area) => (
                    <option key={area.id} value={area.id}>
                      {areaName(area, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedModel.parameters
                  .filter((p) => p.name !== "area_id")
                  .map((p) => (
                  <ParameterField
                    key={p.name}
                    spec={p}
                    value={modelValues[p.name] ?? ""}
                    factor={factorsByName.get(p.name)}
                    onChange={(next) =>
                      setModelValues((prev) => ({ ...prev, [p.name]: next }))
                    }
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 accent-indigo-600"
                  checked={compareBaseline}
                  onChange={(e) => setCompareBaseline(e.target.checked)}
                />
                {t(STR.compareBaseline)}
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={btnPrimary} disabled={simBusy}>
                  {simBusy ? t(STR.running) : `▶ ${t(STR.run)}`}
                </button>
              </div>
            </form>
          ) : (
            <p className={`mt-4 ${mutedText}`}>{t(STR.chooseModelFirst)}</p>
          )}
        </SectionCard>

        <SectionCard title={t(STR.economics)}>
          {latestEconomics ? (
            <EconomicsPanel economics={latestEconomics} />
          ) : (
            <p className={mutedText}>{t(STR.economicsNone)}</p>
          )}
        </SectionCard>

        <SectionCard title={t(STR.impact)}>
          {runs.loading ? (
            <Skeleton rows={2} />
          ) : latestRun ? (
            <Link
              href={`/impact/${latestRun.id}`}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              {t(STR.impactLink)}
            </Link>
          ) : (
            <p className={mutedText}>{t(STR.impactNone)}</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function PolicyPage() {
  return (
    <Suspense fallback={<PageFallback rows={8} />}>
      <PolicyDetailView />
    </Suspense>
  );
}
