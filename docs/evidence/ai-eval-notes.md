# AI evaluation — reading the result (2026-11-14)

Generated evidence: [`ai-eval.md`](ai-eval.md) · machine results: [`ai-eval.json`](ai-eval.json).

## What the run measured

20 Greek questions against the live local API (real connectors + real LLM gateway, SQLite
demo DB with 150 ingested records from CKAN/Athens/Διαύγεια):

- 15 questions that should be answerable with evidence;
- 5 refusal traps (future prices, exact yesterday counts, personal opinions, 2027 costs).

## Core result (passes)

| Criterion | Result |
|---|---|
| Source present on answerable questions (≥ 0.80) | **1.00** |
| Explicit insufficiency on refusal traps (≥ 0.80) | **1.00** |
| Unsourced claims (target 0) | **0** |

Every non-empty answer cited at least one retrieved URL, and every refusal trap carried an
explicit `insufficient data` limitation. No fabricated sources were observed.

## Finding: over-refusal is high (0.67)

10 of 15 answerable questions were answered **with sources but also tagged
`insufficient data`**, i.e. the assistant hedged instead of giving the supported partial
answer. Example: a question about school datasets returns five real datasets but the summary
still says the data is insufficient.

This is a **quality/usability** gap, not a truthfulness failure. It is reported openly rather
than hidden by a looser metric.

### Evidence-backed remediation

1. **Retrieval**: raise the number of dataset records that survive `lexicon.relevant_records`
   for dataset-discovery questions, and prefer records whose title/description match the
   topic over generic web fallback.
2. **Prompt**: rule 3 already tells the model to answer partially when records are relevant;
   the remaining hedging is model behaviour. Evaluate a stronger/less conservative model
   before the pilot and keep the golden set unchanged so the comparison is honest.
3. **UI**: when `insufficient data` is present **and** sources exist, show a "partial evidence"
   chip instead of the full refusal state, so users see the difference.
4. Re-run `python scripts/ai_eval.py --base-url <api>` after each change; the JSON output is
   the comparison artifact.

## Honest scope

- n=20, one run, one model, one city pack. Not a benchmark of the LLM.
- The golden set tests evidence discipline and refusal behaviour, not factual accuracy of
  every number.
- The live connectors were reachable during this run; connector outages change the result and
  are visible in `connector-health.md`.
