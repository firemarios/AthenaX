"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AIResponse, ExampleChips, MapPanel, formatLimitation, useI18n } from "@policylab/ui";
import type { AIAnswer, Meta } from "@policylab/types";
import { doPost } from "@/_shared/hooks";
import { postStream } from "@/_shared/stream";
import {
  ErrorPanel,
  NoticeBox,
  PageFallback,
  PageHeader,
  Tag,
  btnPrimary,
  inputCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Ρωτήστε την πόλη", en: "Ask the City" },
  desc: {
    el: "Η βοηθός ερωτήσεων απαντά με βάση τα δημόσια δεδομένα της πόλης, πάντα με αναφορά πηγής.",
    en: "The question assistant answers from the city's public data, always citing sources.",
  },
  label: { el: "Η ερώτησή σας", en: "Your question" },
  placeholder: {
    el: "π.χ. Ποιες περιοχές της Αθήνας έχουν λιγότερους χώρους πρασίνου;",
    en: "e.g. Which areas of Athens have fewer green spaces?",
  },
  submit: { el: "Αποστολή ερώτησης", en: "Send question" },
  sending: { el: "Αποστολή…", en: "Sending…" },
  examples: { el: "Παραδείγματα ερωτήσεων", en: "Example questions" },
  honesty: {
    el: "Η ερώτηση αποστέλλεται στην πηγή δεδομένων· η απάντηση συντάσσεται από μοντέλο γλώσσας πάνω σε δημόσια σύνολα, με παραπομπές στις πηγές.",
    en: "Your question is sent to the data source; the answer is composed by a language model over public datasets, with references to the sources.",
  },
  limitationsTitle: { el: "Περιορισμοί", en: "Limitations" },
  staticLimitations: {
    el: "Οι απαντήσεις βασίζονται σε δημόσια δεδομένα και μπορεί να περιέχουν κενά ή ανακρίβειες· δεν αποτελούν επίσημη θέση ή συμβουλή. Ελέγχετε πάντα τις πηγές.",
    en: "Answers rely on public data and may contain gaps or inaccuracies; they are not an official position or advice. Always check the sources.",
  },
  records: { el: "Καταχωρήσεις που εξετάστηκαν", en: "Records examined" },
  sources: { el: "Πηγές", en: "Sources" },
  emptyTitle: { el: "Δεν υπάρχουν αρκετά δεδομένα", en: "Not enough data" },
  emptyDesc: {
    el: "Δεν βρέθηκαν αρκετά σχετικά δεδομένα για αξιόπιστη απάντηση.",
    en: "Not enough relevant data was found for a reliable answer.",
  },
  exampleList: [
    "Ποιες περιοχές της Αθήνας έχουν λιγότερους χώρους πρασίνου;",
    "Πόσα έργα συγκοινωνίας έχουν ολοκληρωθεί τα τελευταία 3 χρόνια;",
    "Ποιες αποφάσεις αφορούν την προστασία των πεζοδρομίων;",
    "Πώς έχει αλλάξει ο πληθυσμός της Αθήνας την τελευταία δεκαετία;",
  ],
  required: {
    el: "Γράψτε μια ερώτηση πριν στείλετε.",
    en: "Write a question before sending.",
  },
  retrieving: { el: "Αναζήτηση πηγών…", en: "Retrieving sources…" },
  writing: { el: "Σύνταξη απάντησης…", en: "Writing the answer…" },
  live: { el: "Η απάντηση γράφεται ζωντανά", en: "Answer streaming live" },
  stepSources: { el: "Αναζήτηση πηγών", en: "Finding sources" },
  stepAnalyze: { el: "Ανάλυση δεδομένων", en: "Analysing data" },
  stepWrite: { el: "Σύνταξη απάντησης", en: "Writing answer" },
  thinkingHint: {
    el: "Το μοντέλο επεξεργάζεται τις πηγές. Σε δύσκολες ερωτήσεις μπορεί να διαρκέσει έως ένα λεπτό.",
    en: "The model is working through the sources. Hard questions can take up to a minute.",
  },
  elapsed: { el: "δευτερόλεπτα", en: "seconds" },
  liveBadge: { el: "Ζωντανά", en: "Live" },
};

function stepStates(phase: "idle" | "retrieving" | "writing", hasText: boolean) {
  if (phase === "retrieving") return ["active", "pending", "pending"] as const;
  if (phase === "writing" && !hasText) return ["done", "active", "pending"] as const;
  return ["done", "done", "active"] as const;
}

type AskResult = {
  answer: AIAnswer;
  meta: Meta | null;
};

function AskView() {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const qParam = sp.get("q") ?? "";

  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [phase, setPhase] = useState<"idle" | "retrieving" | "writing">("idle");
  const autoRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const runSubmit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setValidation(t(STR.required));
      return;
    }
    setValidation(null);
    setError(null);
    setResult(null);
    setStreamText("");
    setPhase("retrieving");
    setElapsed(0);
    setLoading(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let settled = false;

    const finish = (answer: AIAnswer, meta: Meta | null) => {
      settled = true;
      setResult({ answer, meta });
      setStreamText("");
      setPhase("idle");
      setLoading(false);
    };

    try {
      await postStream(
        "/v1/ai/query/stream",
        { question: trimmed, city: "Athens" },
        (event, payload) => {
          if (event === "meta") {
            setPhase("writing");
            return;
          }
          if (event === "token") {
            const text = typeof payload.text === "string" ? payload.text : "";
            if (text) {
              setPhase("writing");
              setStreamText((prev) => prev + text);
            }
            return;
          }
          if (event === "done") {
            const answer = payload.answer as AIAnswer | undefined;
            if (!answer) return;
            finish(answer, (payload.meta as Meta | undefined) ?? null);
          }
        },
        ac.signal
      );
    } catch {
      /* fall back to the non-streaming endpoint below */
    }

    if (ac.signal.aborted) return;

    if (!settled) {
      const res = await doPost<AIAnswer>("/v1/ai/query", {
        question: trimmed,
        city: "Athens",
      });
      if (res.error || !res.data) {
        setError(res.error ?? t(STR.required));
        setPhase("idle");
        setLoading(false);
        setStreamText("");
      } else {
        finish(res.data, res.meta);
      }
    }

    if (abortRef.current === ac) abortRef.current = null;
  };

  const handleSubmit = () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setValidation(t(STR.required));
      return;
    }
    autoRef.current = trimmed;
    const next = new URLSearchParams(sp.toString());
    next.set("q", trimmed);
    router.replace(`?${next.toString()}`, { scroll: false });
    void runSubmit(trimmed);
  };

  const submitRef = useRef(runSubmit);
  useEffect(() => {
    submitRef.current = runSubmit;
  });

  useEffect(() => {
    if (!qParam) return;
    if (autoRef.current === qParam) return;
    autoRef.current = qParam;
    setQuestion(qParam);
    void submitRef.current(qParam);
  }, [qParam]);

  const meta = result?.meta ?? null;
  const ui = meta?.ui ?? null;
  const limitations = Array.from(
    new Set([...(result?.answer.limitations ?? []), ...(meta?.limitations ?? [])])
  );
  const steps = [STR.stepSources, STR.stepAnalyze, STR.stepWrite];
  const states = stepStates(phase, Boolean(streamText));
  const phaseLabel = phase === "retrieving" ? t(STR.retrieving) : t(STR.writing);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title={t(STR.title)} description={t(STR.desc)} />

      <NoticeBox>{t(STR.honesty)}</NoticeBox>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label htmlFor="ask-question" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t(STR.label)}
        </label>
        <textarea
          id="ask-question"
          className={`${inputCls} min-h-32 resize-y text-base`}
          placeholder={t(STR.placeholder)}
          value={question}
          maxLength={2000}
          rows={5}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (validation) setValidation(null);
          }}
        />
        {validation ? (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {validation}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btnPrimary} disabled={loading}>
            {loading ? t(STR.sending) : t(STR.submit)}
          </button>
          {question.trim() ? (
            <button
              type="button"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              onClick={() => {
                abortRef.current?.abort();
                abortRef.current = null;
                setQuestion("");
                setResult(null);
                setError(null);
                setStreamText("");
                setPhase("idle");
                setLoading(false);
                autoRef.current = null;
                router.replace("/ask", { scroll: false });
              }}
            >
              {t({ el: "Καθαρισμός", en: "Clear" })}
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-6">
        <p className={`mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300`}>
          {t(STR.examples)}
        </p>
        <ExampleChips items={STR.exampleList} onPick={(q) => setQuestion(q)} />
      </div>

      <div className="mt-8 space-y-6" aria-live="polite">
        {loading ? (
          <div aria-busy="true" aria-live="polite">
            {streamText ? (
              <div className="relative overflow-hidden rounded-[var(--radius-card)] border-l-4 border-primary bg-primary/5 p-4">
                <div className="pl-progress absolute inset-x-0 top-0 h-0.5 bg-primary/70" aria-hidden="true" />
                <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-primary">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="pl-live-dot inline-block h-2 w-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    {t(STR.liveBadge)}
                  </span>
                  <span className="normal-case tabular-nums text-muted-foreground">{elapsed}s</span>
                </div>
                <p className="sr-only">{t(STR.live)}</p>
                <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                  {streamText}
                  <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">
                    ▍
                  </span>
                </p>
              </div>
            ) : (
              <div className="pl-thinking relative overflow-hidden rounded-[var(--radius-card)] border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-sm">
                <div className="pl-progress absolute inset-x-0 top-0 h-0.5 bg-primary/60" aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" aria-hidden="true" />
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
                      <circle cx="12" cy="12" r="3.2" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {phaseLabel}
                      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
                        <span className="pl-dot h-1 w-1 rounded-full bg-primary" />
                        <span className="pl-dot h-1 w-1 rounded-full bg-primary" />
                        <span className="pl-dot h-1 w-1 rounded-full bg-primary" />
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t(STR.thinkingHint)} ·{" "}
                      <span className="tabular-nums">
                        {elapsed}s
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
                  <div className="pl-progress h-full w-1/3 rounded-full bg-primary/70" />
                </div>

                <ol className="mt-4 grid gap-2 sm:grid-cols-3">
                  {steps.map((step, index) => {
                    const state = states[index];
                    const chip =
                      state === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : state === "active"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-zinc-200 bg-card text-muted-foreground dark:border-zinc-800";
                    return (
                      <li
                        key={t(step)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${chip}`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            state === "done"
                              ? "bg-emerald-600 text-white"
                              : state === "active"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {state === "done" ? "✓" : index + 1}
                        </span>
                        <span>{t(step)}</span>
                        {state === "active" ? (
                          <span
                            className="pl-live-dot ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 space-y-2" aria-hidden="true">
                  {[92, 78, 86, 64].map((width) => (
                    <div
                      key={width}
                      className="pl-shimmer h-3.5 rounded"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void runSubmit(question)} />
        ) : result ? (
          <>
            {ui?.alert ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-100"
              >
                {ui.alert}
              </div>
            ) : null}

            {ui?.empty_state ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(STR.emptyTitle)}
                </p>
                <p className={`mt-1 ${mutedText}`}>{t(STR.emptyDesc)}</p>
                {ui.suggested_actions && ui.suggested_actions.length > 0 ? (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {ui.suggested_actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <AIResponse answer={result.answer} meta={meta} />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              {typeof meta?.record_count === "number" ? (
                <Tag>
                  {t(STR.records)}: {meta.record_count}
                </Tag>
              ) : null}
              {(meta?.sources ?? []).map((source) => (
                <Tag key={source}>{source}</Tag>
              ))}
            </div>

            {ui?.show_map ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <MapPanel center={[23.7275, 37.9838]} zoom={11} height="320px" />
              </div>
            ) : null}

            <NoticeBox tone="warning">
              <p className="font-semibold">{t(STR.limitationsTitle)}</p>
              <p className="mt-1">{t(STR.staticLimitations)}</p>
              {limitations.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {limitations.map((item) => (
                    <li key={item}>{formatLimitation(item, t)}</li>
                  ))}
                </ul>
              ) : null}
            </NoticeBox>
          </>
        ) : (
          <NoticeBox tone="warning">
            <p className="font-semibold">{t(STR.limitationsTitle)}</p>
            <p className="mt-1">{t(STR.staticLimitations)}</p>
          </NoticeBox>
        )}
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<PageFallback rows={6} />}>
      <AskView />
    </Suspense>
  );
}
