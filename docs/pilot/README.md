# Internal usability pilot kit (n = 6-8)

> This is an **internal usability pilot** with colleagues and mentors — **not** a citizen
> pilot, not a representative survey, and not a claim of external validation. Results are
> reported as usability findings only.

## Goal

Verify that an analyst who has never seen AthenaX can complete the flagship journey and
produce a defensible evidence dossier in under 20 minutes:

1. Ask a question and read the sources/limitations.
2. Create a policy for an Athens area.
3. Run a simulation and open its passport.
4. Reproduce the run with the same seed and confirm identical metrics.
5. Open the 6-dimension impact report and export it.

## Participants

- Target **6-8** internal testers (colleagues + 1-2 mentors with urban-planning or
  public-policy background).
- Convenience sample. Record role and self-reported familiarity with GIS/policy analysis,
  but do not present the sample as representative.
- Each participant signs a one-page consent/notes form (no personal data is stored).

## Protocol (per session, 30 minutes)

| Step | Duration | What the facilitator does | What is recorded |
|---|---|---|---|
| Briefing | 3 min | Explains the task, not the UI | Role, familiarity (1-5) |
| Think-aloud journey | 15 min | Does not help unless blocked >2 min | Task success (Y/N), time-to-first-answer, time-to-dossier, hesitation points |
| Questions | 5 min | Neutral prompts: "what did this number mean to you?" | Quotes (verbatim, anonymised) |
| SUS-lite | 4 min | 6-item usefulness/clarity scale | Scores |
| Debrief | 3 min | "Would you use this in your work? What would you trust least?" | Risks and trust concerns |

**Facilitator rule:** do not explain the interface before the participant tries it. If a
participant is blocked for more than two minutes, mark the task as failed and help — a task
completed with help is not a success.

## Metrics reported

- **Task success rate** per step (n successes / n participants).
- **Median time** to first sourced answer and to exported dossier.
- **Top 5 friction points**, each with a verbatim quote and a proposed fix.
- **SUS-lite mean** (1-5) with raw responses.
- **Trust findings**: which number did participants question, and why.

## What we will NOT claim

- No statistical significance; n is small and non-probabilistic.
- No "citizen adoption" or "validated by the public".
- No model accuracy claim from usability sessions — model validation lives in
  `research/validation/`.

## Files

- `docs/pilot/session-template.md` — one form per participant.
- `research/reports/pilot-2026-11.md` — the report (status and method first, results added
  only after real sessions run).
- `infrastructure/deployment/smoke.ps1` — use this to pre-warm the environment before each
  session.
