"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, Skeleton, StatCard, useI18n } from "@policylab/ui";
import type { Comment, Consultation, Proposal } from "@policylab/types";
import { GENERIC_ERROR, doDelete, doGet, doPost, useApi } from "@/_shared/hooks";
import { fmtDate } from "@/_shared/format";
import { areaName, type CityArea } from "@/_shared/geo";
import { CATEGORY_OPTIONS } from "@/_shared/terms";
import {
  DeleteButton,
  ErrorPanel,
  Field,
  KeyValueTable,
  NoticeBox,
  PageHeader,
  SectionCard,
  btnPrimary,
  inputCls,
  labelCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Λαϊκό Εργαστήριο", en: "Citizen Lab" },
  desc: {
    el: "Διαβουλεύσεις, προτάσεις και σχόλια πολιτών — με διαφάνεια και σεβασμό στην αντιπροσωπευτική διαδικασία.",
    en: "Consultations, proposals and comments from residents — with transparency and respect for representative process.",
  },
  disclaimer: {
    el: "Οι διαδικτυακές ψήφοι και προτάσεις δεν ταυτίζονται με αντιπροσωπευτική κοινωνική γνώμη ή θεσμική απόφαση.",
    en: "Online votes and proposals do not constitute representative public opinion or an institutional decision.",
  },
  statProposals: { el: "Προτάσεις", en: "Proposals" },
  statConsultations: { el: "Διαβούλευσεις", en: "Consultations" },
  statComments: { el: "Σχόλια", en: "Comments" },
  consultations: { el: "Ενεργές διαβουλεύσεις", en: "Consultations" },
  consultEmpty: { el: "Δεν υπάρχουν διαβουλεύσεις ακόμη.", en: "No consultations yet." },
  proposals: { el: "Προτάσεις πολιτών", en: "Citizen proposals" },
  proposalEmpty: { el: "Δεν υπάρχουν προτάσεις ακόμη.", en: "No proposals yet." },
  proposalEmptyDesc: {
    el: "Υποβάλετε την πρώτη σας πρόταση για την πόλη.",
    en: "Submit your first proposal for the city.",
  },
  newProposal: { el: "Νέα πρόταση", en: "New proposal" },
  fTitle: { el: "Τίτλος πρότασης", en: "Proposal title" },
  fTitlePh: { el: "π.χ. Περισσότερα δέντρα στο Κολωνάκι", en: "e.g. More trees in Kolonaki" },
  fTitleRequired: { el: "Ο τίτλος είναι υποχρεωτικός.", en: "Title is required." },
  fDesc: { el: "Περιγραφή", en: "Description" },
  fDescPh: { el: "Περιγράψτε την πρότασή σας…", en: "Describe your proposal…" },
  fDescRequired: { el: "Η περιγραφή είναι υποχρεωτική.", en: "Description is required." },
  fArea: { el: "Περιοχή", en: "Area" },
  areaAll: { el: "Ολόκληρη η πόλη", en: "City-wide" },
  fCategory: { el: "Κατηγορία", en: "Category" },
  submit: { el: "Υποβολή πρότασης", en: "Submit proposal" },
  submitting: { el: "Υποβολή…", en: "Submitting…" },
  created: {
    el: "Η πρόταση καταχωρήθηκε επιτυχώς.",
    en: "The proposal was submitted successfully.",
  },
  expand: { el: "Προβολή λεπτομερειών", en: "View details" },
  collapse: { el: "Απόκρυψη", en: "Hide" },
  detailLoading: { el: "Φόρτωση λεπτομερειών…", en: "Loading details…" },
  comments: { el: "Σχόλια", en: "Comments" },
  noComments: { el: "Κανένα σχόλιο ακόμη.", en: "No comments yet." },
  commentPh: { el: "Γράψτε ένα σχόλιο…", en: "Write a comment…" },
  commentSubmit: { el: "Αποστολή σχολίου", en: "Post comment" },
  commentSending: { el: "Αποστολή…", en: "Posting…" },
  commentAdded: { el: "Το σχόλιο προστέθηκε.", en: "Comment added." },
  postedBy: { el: "Καταχώρηση", en: "Entry" },
  analysis: { el: "Ανάλυση συμμετοχής", en: "Participation analysis" },
  analysisNote: {
    el: "Τα νούμερα είναι ενδεικτικά της δραστηριότητας στην πλατφόρμα και δεν αποτελούν στατιστική απεικόνιση της κοινωνικής γνώμης.",
    en: "These figures indicatively reflect platform activity and are not a statistical representation of public opinion.",
  },
  open: { el: "σε εξέλιξη", en: "open" },
  closed: { el: "Κλειστή", en: "Closed" },
  window: { el: "Παράθυρο", en: "Window" },
  nestedProposals: { el: "Προτάσεις", en: "Proposals" },
  noNested: { el: "Χωρίς προτάσεις.", en: "No proposals." },
  areaLabel: { el: "Περιοχή", en: "Area" },
  loading: { el: "Φόρτωση…", en: "Loading…" },
  participation: { el: "Συμμετοχή", en: "Participation" },
};

function consultationStatus(status: string): { tone: "neutral" | "success" | "warning" | "error" | "info"; label: { el: string; en: string } } {
  if (status === "open") return { tone: "success", label: { el: STR.open.el, en: STR.open.en } };
  if (status === "closed") return { tone: "neutral", label: { el: STR.closed.el, en: STR.closed.en } };
  return { tone: "neutral", label: { el: status, en: status } };
}

function ProposalItem({
  proposal,
  onCommentCountChange,
  onDeleted,
}: {
  proposal: Proposal;
  onCommentCountChange: (id: string, delta: number) => void;
  onDeleted: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Proposal | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const expand = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (detail || loading) return;
    setLoading(true);
    setError(null);
    const [d, c] = await Promise.all([
      doGet<Proposal>(`/v1/proposals/${encodeURIComponent(proposal.id)}`),
      doGet<Comment[]>(`/v1/proposals/${encodeURIComponent(proposal.id)}/comments`),
    ]);
    setLoading(false);
    if (d.error || !d.data) {
      setError(d.error ?? t({ el: "Αδυναμία φόρτωσης λεπτομερειών.", en: "Failed to load details." }));
      return;
    }
    setDetail(d.data);
    if (!c.error && c.data) setComments(c.data);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setPostError(t({ el: "Γράψτε ένα σχόλιο πριν την αποστολή.", en: "Write a comment before posting." }));
      return;
    }
    setPostError(null);
    setPosting(true);
    const res = await doPost<Comment>(
      `/v1/proposals/${encodeURIComponent(proposal.id)}/comments`,
      { body: trimmed }
    );
    setPosting(false);
    if (res.error || !res.data) {
      setPostError(res.error ?? t({ el: "Αποτυχία αποστολής σχολίου.", en: "Failed to post the comment." }));
      return;
    }
    setComments((prev) => [...prev, res.data as Comment]);
    setBody("");
    setPosted(true);
    onCommentCountChange(proposal.id, 1);
  };

  const deleteComment = async (commentId: string): Promise<string | null> => {
    const res = await doDelete(
      `/v1/proposals/${encodeURIComponent(proposal.id)}/comments/${encodeURIComponent(commentId)}`
    );
    if (res.error) return res.error;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentCountChange(proposal.id, -1);
    return null;
  };

  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {proposal.title}
          </p>
          <p className={`mt-1 ${mutedText}`}>
            {proposal.area || t(STR.areaAll)}
            {proposal.category ? ` · ${proposal.category}` : ""} ·{" "}
            {fmtDate(proposal.created_at, lang)} ·{" "}
            {proposal.comments_count} {t(STR.comments).toLowerCase()}
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnPrimary}
            aria-expanded={open}
            onClick={expand}
          >
            {open ? t(STR.collapse) : t(STR.expand)}
          </button>
          <DeleteButton
            compact
            onConfirm={async () => {
              const res = await doDelete(`/v1/proposals/${encodeURIComponent(proposal.id)}`);
              if (res.error) return res.error;
              onDeleted(proposal.id);
              return null;
            }}
          />
        </span>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          {loading ? (
            <Skeleton rows={4} />
          ) : error ? (
            <ErrorPanel message={error} onRetry={expand} />
          ) : detail ? (
            <>
              <div>
                <h4 className={`mb-1 ${labelCls}`}>{t(STR.fDesc)}</h4>
                <p className="whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">
                  {detail.description}
                </p>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(STR.comments)} ({comments.length})
                </h4>
                {comments.length === 0 ? (
                  <p className={mutedText}>{t(STR.noComments)}</p>
                ) : (
                  <ul className="space-y-2">
                    {comments.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3"
                      >
                        <p className="whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">
                          {c.body}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-xs ${mutedText}`}>
                            {t(STR.postedBy)}: {fmtDate(c.created_at, lang)}
                          </p>
                          <DeleteButton compact onConfirm={() => deleteComment(c.id)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {posted ? (
                <p
                  role="status"
                  className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
                >
                  ✓ {t(STR.commentAdded)}
                </p>
              ) : null}

              <form onSubmit={submitComment} className="space-y-2">
                <Field
                  label={t(STR.comments)}
                  htmlFor={`comment-${proposal.id}`}
                  error={postError}
                >
                  <textarea
                    id={`comment-${proposal.id}`}
                    rows={3}
                    className={inputCls}
                    value={body}
                    placeholder={t(STR.commentPh)}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </Field>
                <button type="submit" className={btnPrimary} disabled={posting}>
                  {posting ? t(STR.commentSending) : t(STR.commentSubmit)}
                </button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function CitizenPage() {
  const { t, lang } = useI18n();

  const [disclaimerOpen, setDisclaimerOpen] = useState(true);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [proposalsLoading, setProposalsLoading] = useState(true);

  const consultations = useApi<Consultation[]>("/v1/consultations");
  const areas = useApi<CityArea[]>("/v1/city/areas");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [areaChoice, setAreaChoice] = useState("");
  const [category, setCategory] = useState("mobility");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    const res = await doGet<Proposal[]>("/v1/proposals");
    setProposalsLoading(false);
    if (res.data) {
      setProposalsError(null);
      setProposals(res.data);
      return;
    }
    setProposalsError(res.error ?? GENERIC_ERROR);
    setProposals([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    doGet<Proposal[]>("/v1/proposals").then((res) => {
      if (cancelled) return;
      setProposalsLoading(false);
      if (res.data) {
        setProposalsError(null);
        setProposals(res.data);
      } else {
        setProposalsError(res.error ?? GENERIC_ERROR);
        setProposals([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = proposals ?? [];
  const consultationList = consultations.data ?? [];
  const totalComments = list.reduce((sum, p) => sum + (p.comments_count || 0), 0);
  const openCount = consultationList.filter((c) => c.status === "open").length;
  const closedCount = consultationList.filter((c) => c.status === "closed").length;

  const areaList = areas.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = true;
    if (title.trim().length < 3) {
      setTitleError(t(STR.fTitleRequired));
      ok = false;
    } else setTitleError(null);
    if (!description.trim()) {
      setDescError(t(STR.fDescRequired));
      ok = false;
    } else setDescError(null);
    if (!ok) return;

    setFormError(null);
    setSuccessNote(false);
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      category,
    };
    if (areaChoice) {
      const found = areaList.find((a) => a.id === areaChoice);
      payload.area = found ? areaName(found, lang) : areaChoice;
    }
    setBusy(true);
    const res = await doPost<Proposal>("/v1/proposals", payload);
    setBusy(false);
    if (res.error || !res.data) {
      setFormError(res.error ?? t({ el: "Αποτυχία υποβολής.", en: "Submission failed." }));
      return;
    }
    setProposals((prev) => [res.data as Proposal, ...(prev ?? [])]);
    setTitle("");
    setDescription("");
    setAreaChoice("");
    setSuccessNote(true);
  };

  const handleCommentCountChange = (id: string, delta: number) => {
    setProposals((prev) =>
      (prev ?? []).map((p) =>
        p.id === id
          ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) + delta) }
          : p
      )
    );
  };

  const handleProposalDeleted = (id: string) => {
    setProposals((prev) => (prev ?? []).filter((p) => p.id !== id));
  };

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      {disclaimerOpen ? (
        <div className="mb-6">
          <NoticeBox tone="warning" onDismiss={() => setDisclaimerOpen(false)}>
            <p className="font-semibold">{t(STR.disclaimer)}</p>
          </NoticeBox>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t(STR.statProposals)}
          value={proposalsLoading ? "…" : list.length}
          hint={t(STR.proposals)}
        />
        <StatCard
          label={t(STR.statConsultations)}
          value={consultations.loading ? "…" : consultationList.length}
          hint={t(STR.consultations)}
        />
        <StatCard
          label={t(STR.statComments)}
          value={proposalsLoading ? "…" : totalComments}
          hint={t(STR.comments)}
        />
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t(STR.consultations)}
          </h2>
          {consultations.loading ? (
            <div aria-busy="true">
              <Skeleton rows={5} />
            </div>
          ) : consultations.error ? (
            <ErrorPanel message={consultations.error} onRetry={consultations.reload} />
          ) : consultationList.length === 0 ? (
            <EmptyState title={t(STR.consultEmpty)} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {consultationList.map((c) => {
                const st = consultationStatus(c.status);
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.title}
                      </h3>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{t(st.label)}</Badge>
                        <DeleteButton
                          compact
                          onConfirm={async () => {
                            const res = await doDelete(
                              `/v1/consultations/${encodeURIComponent(c.id)}`
                            );
                            if (res.error) return res.error;
                            consultations.reload();
                            loadProposals();
                            return null;
                          }}
                        />
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${mutedText}`}>{c.description}</p>
                    <p className={`mt-2 text-xs ${mutedText}`}>
                      {t(STR.window)}: {fmtDate(c.starts_at, lang)} – {fmtDate(c.ends_at, lang)}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                        {t(STR.nestedProposals)} ({c.proposals?.length ?? 0})
                      </summary>
                      {c.proposals && c.proposals.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {c.proposals.map((p) => (
                            <li
                              key={p.id}
                              className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-sm"
                            >
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {p.title}
                              </span>
                              <span className={`ml-2 ${mutedText}`}>
                                {p.area || t(STR.areaAll)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`mt-2 text-sm ${mutedText}`}>{t(STR.noNested)}</p>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t(STR.proposals)}
          </h2>

          <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              + {t(STR.newProposal)}
            </h3>
            {formError ? (
              <div className="mb-3">
                <ErrorPanel message={formError} onRetry={() => setFormError(null)} />
              </div>
            ) : null}
            {successNote ? (
              <p
                role="status"
                className="mb-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100"
              >
                ✓ {t(STR.created)}
              </p>
            ) : null}
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <Field
                label={t(STR.fTitle)}
                htmlFor="proposal-title"
                required
                error={titleError}
              >
                <input
                  id="proposal-title"
                  className={inputCls}
                  value={title}
                  placeholder={t(STR.fTitlePh)}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                />
              </Field>
              <Field
                label={t(STR.fDesc)}
                htmlFor="proposal-desc"
                required
                error={descError}
              >
                <textarea
                  id="proposal-desc"
                  rows={4}
                  className={inputCls}
                  value={description}
                  placeholder={t(STR.fDescPh)}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descError) setDescError(null);
                  }}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="proposal-area" className={labelCls}>
                    {t(STR.fArea)}
                  </label>
                  <select
                    id="proposal-area"
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
                  </select>
                </div>
                <div>
                  <label htmlFor="proposal-category" className={labelCls}>
                    {t(STR.fCategory)}
                  </label>
                  <select
                    id="proposal-category"
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
              </div>
              <button type="submit" className={btnPrimary} disabled={busy}>
                {busy ? t(STR.submitting) : t(STR.submit)}
              </button>
            </form>
          </div>

          {proposalsLoading ? (
            <div aria-busy="true">
              <Skeleton rows={5} />
            </div>
          ) : proposalsError ? (
            <ErrorPanel message={proposalsError} onRetry={loadProposals} />
          ) : list.length === 0 ? (
            <EmptyState
              title={t(STR.proposalEmpty)}
              description={t(STR.proposalEmptyDesc)}
            />
          ) : (
            <ul className="space-y-3">
              {list.map((p) => (
                <ProposalItem
                  key={p.id}
                  proposal={p}
                  onCommentCountChange={handleCommentCountChange}
                  onDeleted={handleProposalDeleted}
                />
              ))}
            </ul>
          )}
        </section>

        <SectionCard title={t(STR.analysis)}>
          <KeyValueTable
            rows={[
              { k: t(STR.statProposals), v: String(list.length) },
              { k: t(STR.statComments), v: String(totalComments) },
              { k: t(STR.statConsultations), v: String(consultationList.length) },
              {
                k: t({ el: "Ανοιχτές διαβουλεύσεις", en: "Open consultations" }),
                v: String(openCount),
              },
              {
                k: t({ el: "Κλειστές διαβουλεύσεις", en: "Closed consultations" }),
                v: String(closedCount),
              },
            ]}
          />
          <p className={`mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-3 ${mutedText}`}>
            {t(STR.analysisNote)}
          </p>
          <p className={`mt-2 ${mutedText}`}>
            <Link
              href="/policies"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t({ el: "Δείτε τις πολιτικές →", en: "See the policies →" })}
            </Link>
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
