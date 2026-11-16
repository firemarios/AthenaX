"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, DataCard, EmptyState, Skeleton, useI18n } from "@athenax/ui";
import type { ResearchProject } from "@athenax/types";
import { GENERIC_ERROR, doDelete, doGet, doPost } from "@/_shared/hooks";
import { fmtDate } from "@/_shared/format";
import {
  DeleteButton,
  ErrorPanel,
  Field,
  PageHeader,
  btnPrimary,
  inputCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Εργαστήριο Έρευνας", en: "Research Workspace" },
  desc: {
    el: "Οργανώστε πειράματα προσομοίωσης, συγκρίνετε μοντέλα και εξάγετε αποτελέσματα με πλήρη προέλευση.",
    en: "Organise simulation experiments, compare models and export results with full provenance.",
  },
  newProject: { el: "Νέο έργο έρευνας", en: "New research project" },
  fName: { el: "Ονομασία έργου", en: "Project name" },
  fNamePh: { el: "π.χ. Σύγκριση μοντέλων πρασίνου", en: "e.g. Green-space model comparison" },
  fNameRequired: {
    el: "Η ονομασία είναι υποχρεωτική (τουλάχιστον 2 χαρακτήρες).",
    en: "Name is required (at least 2 characters).",
  },
  fDesc: { el: "Περιγραφή", en: "Description" },
  fDescPh: { el: "Σύντομη περιγραφή του έργου…", en: "Brief project description…" },
  submit: { el: "Δημιουργία έργου", en: "Create project" },
  submitting: { el: "Δημιουργία…", en: "Creating…" },
  count: { el: "έργα", en: "projects" },
  experiments: { el: "πειράματα", en: "experiments" },
  loading: { el: "Φόρτωση έργων…", en: "Loading projects…" },
  empty: { el: "Κανένα έργο έρευνας ακόμη", en: "No research projects yet" },
  emptyDesc: {
    el: "Αποθηκεύστε πειράματα, συγκρίνετε μοντέλα και επαναλάβετε αποτελέσματα.",
    en: "Store experiments, compare models and reproduce results.",
  },
  open: { el: "Προβολή →", en: "View →" },
  created: { el: "Δημιουργήθηκε", en: "Created" },
  listTitle: { el: "Έργα", en: "Projects" },
};

export default function ResearchPage() {
  const { t, lang } = useI18n();

  const [list, setList] = useState<ResearchProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await doGet<ResearchProject[]>("/v1/research/projects");
    if (res.data) {
      setError(null);
      setList(res.data);
      return;
    }
    setError(res.error ?? GENERIC_ERROR);
    setList((prev) => prev ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    doGet<ResearchProject[]>("/v1/research/projects").then((res) => {
      if (cancelled) return;
      if (res.data) {
        setError(null);
        setList(res.data);
      } else {
        setError(res.error ?? GENERIC_ERROR);
        setList((prev) => prev ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loading = list === null && !error;
  const shown = list ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError(t(STR.fNameRequired));
      return;
    }
    setNameError(null);
    setFormError(null);
    setBusy(true);
    const res = await doPost<ResearchProject>("/v1/research/projects", {
      name: name.trim(),
      description: description.trim() || null,
    });
    setBusy(false);
    if (res.error || !res.data) {
      setFormError(
        res.error ?? t({ el: "Αποτυχία δημιουργίας έργου.", en: "Failed to create the project." })
      );
      return;
    }
    setList((prev) => [res.data as ResearchProject, ...(prev ?? [])]);
    setName("");
    setDescription("");
  };

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          + {t(STR.newProject)}
        </h2>
        {formError ? (
          <div className="mb-3">
            <ErrorPanel message={formError} onRetry={() => setFormError(null)} />
          </div>
        ) : null}
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <Field
            label={t(STR.fName)}
            htmlFor="research-name"
            required
            error={nameError}
          >
            <input
              id="research-name"
              className={inputCls}
              value={name}
              placeholder={t(STR.fNamePh)}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
            />
          </Field>
          <Field label={t(STR.fDesc)} htmlFor="research-desc">
            <textarea
              id="research-desc"
              rows={3}
              className={inputCls}
              value={description}
              placeholder={t(STR.fDescPh)}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? t(STR.submitting) : t(STR.submit)}
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t(STR.listTitle)}
        </h2>
        <p className={mutedText} aria-live="polite">
          {loading ? t(STR.loading) : `${shown.length} ${t(STR.count)}`}
        </p>
      </div>

      {loading ? (
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">{t(STR.loading)}</span>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            ))}
          </div>
          <Skeleton rows={3} />
        </div>
      ) : error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : shown.length === 0 ? (
        <EmptyState title={t(STR.empty)} description={t(STR.emptyDesc)} />
      ) : (
        <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((project) => (
            <li key={project.id} className="flex">
              <DataCard
                title={project.name}
                subtitle={project.description ?? undefined}
                badge={
                  <Badge tone="info">
                    {project.experiments?.length ?? 0} {t(STR.experiments)}
                  </Badge>
                }
                meta={
                  <span>
                    {t(STR.created)}: {fmtDate(project.created_at, lang)}
                  </span>
                }
                footer={
                  <span className="flex w-full flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/research/${project.id}`}
                      className="rounded font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {t(STR.open)}
                    </Link>
                    <DeleteButton
                      compact
                      onConfirm={async () => {
                        const res = await doDelete(`/v1/research/projects/${encodeURIComponent(project.id)}`);
                        if (res.error) return res.error;
                        setList((prev) =>
                          (prev ?? []).filter((item) => item.id !== project.id)
                        );
                        return null;
                      }}
                    />
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
