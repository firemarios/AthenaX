# AI evidence-first evaluation

- Generated: **2026-11-14T09:14:44.268546+00:00**
- API: `http://127.0.0.1:8000`
- Questions: **20**
- Source-hit rate (answerable questions): **1.0**
- Correct insufficient-data rate: **1.0**
- Unsourced claims (target 0): **0**
- Over-refusal on answerable questions (diagnostic): **0.6667**

## Pass criteria

The contract is: every answer either cites at least one retrieved source or explicitly says
the data is insufficient — never an unsourced claim. Over-refusal is reported separately as
a usability/quality signal; it does not make an answer untruthful.

- source present on answerable questions ≥ 0.80 → **PASS**
- explicit insufficiency on refusal traps ≥ 0.80 → **PASS**
- unsourced claims == 0 → **PASS**
- over-refusal (diagnostic, not gating; target ≤ 0.20) → **WARN (0.6667)**

## Per-question results

| id | expect | sources | insufficient | keyword | unsourced | error |
|---|---|---|---|---|---|---|
| q01 | sources | 1 | False | True | False |  |
| q02 | sources | 37 | True | False | False |  |
| q03 | sources | 2 | True | True | False |  |
| q04 | sources | 4 | False | True | False |  |
| q05 | sources | 6 | True | True | False |  |
| q06 | sources | 6 | True | True | False |  |
| q07 | sources | 2 | True | True | False |  |
| q08 | sources | 5 | True | True | False |  |
| q09 | sources | 4 | True | True | False |  |
| q10 | sources | 2 | False | True | False |  |
| q11 | sources | 19 | True | True | False |  |
| q12 | sources | 9 | True | True | False |  |
| q13 | sources | 3 | False | True | False |  |
| q14 | sources | 2 | True | True | False |  |
| q15 | sources | 8 | False | False | False |  |
| q16 | insufficient | 2 | True | True | False |  |
| q17 | insufficient | 19 | True | True | False |  |
| q18 | insufficient | 12 | True | True | False |  |
| q19 | insufficient | 5 | True | True | False |  |
| q20 | insufficient | 4 | True | True | False |  |
