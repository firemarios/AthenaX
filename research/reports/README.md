# AthenaX — Research Reports

Published, citable outputs derived from AthenaX data and simulations.

## What belongs here

- Pilot studies and policy scenario analyses (e.g. the flagship *"traffic in an Athens area"*
  study) with baseline-vs-scenario comparisons.
- Data source audits summarised for external audiences.
- Reproduction notes (second person reproduced a passport run — PRD K6).
- Anything referenced from the in-product **Research Workspace** (`/research` module,
  `GET /v1/research/projects/{id}/export?format=md|csv|json`).

Experiment activity logs stay in [`../experiments/`](../experiments/); signed model trust
statements stay in [`../validation/`](../validation/).

## How reports are published

1. **Draft from the platform.** Create a Research Project in `/research`, attach experiment
   run ids, export **markdown** — the export already contains a **provenance section**
   (sources + licences, model versions, run ids, timestamps). Do not hand-wave provenance:
   the export is the baseline of the report.
2. **Review.** Evidence-first check: every number traces to a run id or dataset id; every AI
   or literature claim has a real source (no invented citations); limitations and passport
   `reliability_limits` are carried over, not dropped.
3. **File it.** Save as `YYYY-MM-DD-<slug>.md` in this folder. Structure:

   ```markdown
   # <Title> (el + en abstract)
   - **Date / authors / status:** draft|reviewed|published
   - **Provenance:** runs, datasets, licences, model versions (from the export)
   ## Executive summary (EL, then EN)
   ## Context & question
   ## Data & methods (link validation reports)
   ## Results (tables, impact dimensions, uncertainty shown)
   ## Limitations (mandatory section)
   ## Conclusions & policy options
   ## Reproduction appendix (inputs, seed, inputs_checksum, run ids)
   ```

4. **Link it.** Add the file to the table below and, when relevant, attach it to the
   in-product research project so `/research` users can find it.
5. **Licence.** Reports are **CC BY 4.0** (attribution: AthenaX contributors); embedded
   third-party data keeps its own licence — reproduce attributions from
   [`docs/data-governance/README.md`](../../docs/data-governance/README.md).
   Datasets remain subject to "public ≠ free".

## Published reports

| Date | Report | Status | Runs / models | Validation |
|---|---|---|---|---|
| — | _(none yet — MVP target: 1 report, PRD K6)_ | | | |

## Quality bar (all mandatory)

- [ ] Provenance section present and complete
- [ ] Every metric linked to run id(s); determinism noted (seed + checksum)
- [ ] Uncertainty ranges and limitations visible — not buried
- [ ] Licences + attribution for every dataset used
- [ ] EL + EN abstract (Greek-first rule)
- [ ] Reviewer named (evidence-first)
