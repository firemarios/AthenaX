"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@athenax/ui";
import type { Policy } from "@athenax/types";
import { doPost, useApi } from "@/_shared/hooks";
import { areaName, type CityArea } from "@/_shared/geo";
import { FactorEditor, ListEditor, type FactorRow } from "@/_shared/forms";
import { CATEGORY_OPTIONS, HORIZON_OPTIONS } from "@/_shared/terms";
import {
  ErrorPanel,
  Field,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Νέα πολιτική", en: "New policy" },
  desc: {
    el: "Συμπληρώστε τα βασικά στοιχεία, προσθέστε παραμέτρους, υποθέσεις και δείκτες απόδοσης (KPI).",
    en: "Fill in the basics, then add parameters, assumptions and key performance indicators.",
  },
  fTitle: { el: "Τίτλος", en: "Title" },
  fTitlePh: { el: "π.χ. Ζώνη προτεραιότητας για ποδήλατα", en: "e.g. Priority zone for cycling" },
  fTitleRequired: {
    el: "Ο τίτλος είναι υποχρεωτικός. Γράψτε τουλάχιστον 3 χαρακτήρες.",
    en: "Title is required. Enter at least 3 characters.",
  },
  fDesc: { el: "Περιγραφή", en: "Description" },
  fDescPh: {
    el: "Περιγράψτε σύντομα την πολιτική και τον στόχο της…",
    en: "Briefly describe the policy and its goal…",
  },
  fChanges: { el: "Αλλαγές σε ελεύθερο κείμενο", en: "Free-text changes" },
  fChangesPh: {
    el: "π.χ. 120 νέα διαμερίσματα στον Κεραμεικό, μείωση ΕΝΦΙΑ 5%, νέοι χώροι πρασίνου…",
    en: "e.g. 120 new apartments in Kerameikos, 5% property-tax relief, new green spaces…",
  },
  changesHint: {
    el: "Το AI θα διαβάσει το κείμενο και θα υπολογίσει τους παράγοντες του μοντέλου.",
    en: "The AI will read this text and calculate the model factors.",
  },
  fCategory: { el: "Κατηγορία", en: "Category" },
  fArea: { el: "Περιοχή εφαρμογής", en: "Area" },
  areaFree: { el: "Ελεύθερο κείμενο…", en: "Free text…" },
  areaFreePh: { el: "Γράψτε την περιοχή…", en: "Type the area…" },
  areaAll: { el: "Ολόκληρη η πόλη", en: "City-wide" },
  fHorizon: { el: "Ορίζοντας", en: "Horizon" },
  fBudget: { el: "Διαθέσιμος προϋπολογισμός (€)", en: "Available budget (EUR)" },
  fBudgetHint: {
    el: "Προαιρετικό. Χρησιμοποιείται για να ελεγχθεί αν το εκτιμώμενο κόστος χωράει στον προϋπολογισμό.",
    en: "Optional. Used to check whether the estimated cost fits the budget.",
  },
  fFactors: { el: "Μεταβαλλόμενοι παράγοντες", en: "Changing factors" },
  fFactorName: { el: "Παράγοντας", en: "Factor" },
  factorsHint: {
    el: "Ορίστε τους παράγοντες που θέλετε να δοκιμάσετε. Χρησιμοποιήστε ονόματα παραμέτρων μοντέλου, π.χ. park_count ή facility_count.",
    en: "Define the factors you want to test. Use model parameter names such as park_count or facility_count.",
  },
  fBase: { el: "Αρχική τιμή", en: "Base value" },
  fMin: { el: "Ελάχιστο", en: "Min" },
  fMax: { el: "Μέγιστο", en: "Max" },
  fUnit: { el: "Μονάδα", en: "Unit" },
  addFactor: { el: "Προσθήκη παράγοντα", en: "Add factor" },
  loadSuggested: { el: "Φόρτωση προτεινόμενων", en: "Load suggested" },
  factorError: {
    el: "Συμπληρώστε όνομα και έγκυρες αριθμητικές τιμές για κάθε παράγοντα (ελάχιστο ≤ αρχική ≤ μέγιστο).",
    en: "Fill a name and valid numeric values for every factor (min ≤ base ≤ max).",
  },
  remove: { el: "Αφαίρεση", en: "Remove" },
  fAssumptions: { el: "Υποθέσεις", en: "Assumptions" },
  assumptionsHint: {
    el: "Μια υπόθεση ανά γραμμή — π.χ. «η ζήτηση παραμένει σταθερή».",
    en: "One assumption per line — e.g. “demand remains constant”.",
  },
  addAssumption: { el: "Προσθήκη υπόθεσης", en: "Add assumption" },
  fKpis: { el: "Δείκτες απόδοσης (KPI)", en: "Key performance indicators (KPI)" },
  kpisHint: {
    el: "Ένας δείκτης ανά γραμμή — π.χ. «ποσοστό κάλυψης 300 μ».",
    en: "One indicator per line — e.g. “coverage within 300 m”.",
  },
  addKpi: { el: "Προσθήκη δείκτη", en: "Add indicator" },
  submit: { el: "Δημιουργία πολιτικής", en: "Create policy" },
  saving: { el: "Αποθήκευση…", en: "Saving…" },
  cancel: { el: "Ακύρωση", en: "Cancel" },
  back: { el: "← Πίσω στις πολιτικές", en: "← Back to policies" },
};

const BASE_FACTORS: FactorRow[] = [
  { name: "new_buildings", baseline: "25", min: "0", max: "500", unit: "buildings" },
  { name: "tax_change_pct", baseline: "0", min: "-50", max: "100", unit: "%" },
  { name: "population", baseline: "10000", min: "100", max: "200000", unit: "people" },
];

const SUGGESTED_FACTORS: Record<string, FactorRow[]> = {
  mobility: BASE_FACTORS,
  green: BASE_FACTORS,
  environment: BASE_FACTORS,
  housing: BASE_FACTORS,
  services: BASE_FACTORS,
};

export default function NewPolicyPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const areas = useApi<CityArea[]>("/v1/city/areas");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changes, setChanges] = useState("");
  const [category, setCategory] = useState("mobility");
  const [areaChoice, setAreaChoice] = useState("");
  const [areaFree, setAreaFree] = useState("");
  const [horizon, setHorizon] = useState("1y");
  const [budget, setBudget] = useState("");
  const [factors, setFactors] = useState<FactorRow[]>(() => SUGGESTED_FACTORS.mobility);
  const [assumptions, setAssumptions] = useState<string[]>([""]);
  const [kpis, setKpis] = useState<string[]>([""]);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const areaList = areas.data ?? [];
  const freeSelected = areaChoice === "__free__";

  const resolveArea = (): string | null => {
    if (freeSelected) {
      const value = areaFree.trim();
      return value || null;
    }
    if (!areaChoice) return null;
    const found = areaList.find((a) => a.id === areaChoice);
    return found ? areaName(found, lang) : areaChoice;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setTitleError(t(STR.fTitleRequired));
      return;
    }
    setTitleError(null);
    setError(null);

    const factorPayload = factors.map((factor) => ({
      name: factor.name.trim(),
      baseline: Number(factor.baseline),
      min: Number(factor.min),
      max: Number(factor.max),
      unit: factor.unit.trim() || null,
    }));
    const invalidFactor = factorPayload.some(
      (factor) =>
        !factor.name ||
        !Number.isFinite(factor.baseline) ||
        !Number.isFinite(factor.min) ||
        !Number.isFinite(factor.max) ||
        factor.min > factor.baseline ||
        factor.baseline > factor.max
    );
    if (invalidFactor) {
      setError(t(STR.factorError));
      return;
    }

    const payload: Record<string, unknown> = {
      title: trimmed,
      category,
      horizon,
      parameters: Object.fromEntries(
        factorPayload.map((factor) => [factor.name, factor.baseline])
      ),
      factors: factorPayload,
      assumptions: assumptions.map((a) => a.trim()).filter(Boolean),
      kpis: kpis.map((k) => k.trim()).filter(Boolean),
    };
    const desc = description.trim();
    if (desc) payload.description = desc;
    const changesText = changes.trim();
    if (changesText) payload.changes = changesText;
    const area = resolveArea();
    if (area) payload.area = area;
    const budgetNum = Number(budget);
    if (budget.trim() && Number.isFinite(budgetNum)) payload.budget_eur = budgetNum;

    setSaving(true);
    const res = await doPost<Policy>("/v1/policies", payload);
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error ?? t({ el: "Αποτυχία δημιουργίας πολιτικής.", en: "Failed to create the policy." }));
      return;
    }
    router.push(`/policies/${res.data.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t(STR.title)}
        description={t(STR.desc)}
        breadcrumbs={[
          { label: t({ el: "Πολιτικές", en: "Policies" }), href: "/policies" },
          { label: t(STR.title) },
        ]}
      />

      {error ? (
        <div className="mb-6">
          <ErrorPanel message={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6"
      >
        <Field
          label={t(STR.fTitle)}
          htmlFor="policy-title"
          required
          error={titleError}
        >
          <input
            id="policy-title"
            className={inputCls}
            value={title}
            placeholder={t(STR.fTitlePh)}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            aria-invalid={titleError ? true : undefined}
          />
        </Field>

        <Field label={t(STR.fDesc)} htmlFor="policy-desc">
          <textarea
            id="policy-desc"
            rows={4}
            className={inputCls}
            value={description}
            placeholder={t(STR.fDescPh)}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field
          label={t(STR.fChanges)}
          htmlFor="policy-changes"
          hint={t(STR.changesHint)}
        >
          <textarea
            id="policy-changes"
            rows={3}
            className={inputCls}
            value={changes}
            placeholder={t(STR.fChangesPh)}
            onChange={(e) => setChanges(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="policy-category" className={labelCls}>
              {t(STR.fCategory)}
            </label>
            <select
              id="policy-category"
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="policy-horizon" className={labelCls}>
              {t(STR.fHorizon)}
            </label>
            <select
              id="policy-horizon"
              className={inputCls}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            >
              {HORIZON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="policy-area" className={labelCls}>
            {t(STR.fArea)}
          </label>
          <select
            id="policy-area"
            className={inputCls}
            value={areaChoice}
            onChange={(e) => setAreaChoice(e.target.value)}
          >
            <option value="">{t(STR.areaAll)}</option>
            {areaList.map((a) => (
              <option key={a.id} value={a.id}>
                {areaName(a, lang)}
              </option>
            ))}
            <option value="__free__">{t(STR.areaFree)}</option>
          </select>
          {freeSelected ? (
            <input
              id="policy-area-free"
              className={`${inputCls} mt-2`}
              value={areaFree}
              placeholder={t(STR.areaFreePh)}
              onChange={(e) => setAreaFree(e.target.value)}
              aria-label={t(STR.areaFree)}
            />
          ) : null}
          {areas.loading ? (
            <p className={`mt-1 ${mutedText}`}>{t({ el: "Φόρτωση περιοχών…", en: "Loading areas…" })}</p>
          ) : null}
          {areas.error ? (
            <p className={`mt-1 ${mutedText}`}>{t({ el: "Μη διαθέσιμες περιοχές — χρησιμοποιήστε ελεύθερο κείμενο.", en: "Areas unavailable — use free text." })}</p>
          ) : null}
        </div>

        <Field
          label={t(STR.fBudget)}
          htmlFor="policy-budget"
          hint={t(STR.fBudgetHint)}
        >
          <input
            id="policy-budget"
            type="number"
            min={0}
            step={1000}
            className={inputCls}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t(STR.fFactors)}
            </h2>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setFactors(SUGGESTED_FACTORS[category] ?? [])}
            >
              {t(STR.loadSuggested)}
            </button>
          </div>
          <p className={`mb-2 ${mutedText}`}>{t(STR.factorsHint)}</p>
          <FactorEditor
            idPrefix="policy-factor"
            rows={factors}
            onChange={setFactors}
            nameLabel={t(STR.fFactorName)}
            baseLabel={t(STR.fBase)}
            minLabel={t(STR.fMin)}
            maxLabel={t(STR.fMax)}
            unitLabel={t(STR.fUnit)}
            addLabel={t(STR.addFactor)}
            removeLabel={t(STR.remove)}
            namePlaceholder="park_count"
          />
        </div>

        <div>
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t(STR.fAssumptions)}
          </h2>
          <p className={`mb-2 ${mutedText}`}>{t(STR.assumptionsHint)}</p>
          <ListEditor
            idPrefix="policy-assumption"
            items={assumptions}
            onChange={setAssumptions}
            label={t(STR.fAssumptions)}
            addLabel={t(STR.addAssumption)}
            removeLabel={t(STR.remove)}
          />
        </div>

        <div>
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t(STR.fKpis)}
          </h2>
          <p className={`mb-2 ${mutedText}`}>{t(STR.kpisHint)}</p>
          <ListEditor
            idPrefix="policy-kpi"
            items={kpis}
            onChange={setKpis}
            label={t(STR.fKpis)}
            addLabel={t(STR.addKpi)}
            removeLabel={t(STR.remove)}
          />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <button type="submit" className={btnPrimary} disabled={saving}>
            {saving ? t(STR.saving) : t(STR.submit)}
          </button>
          <Link href="/policies" className={btnSecondary}>
            {t(STR.cancel)}
          </Link>
        </div>
      </form>
    </div>
  );
}
