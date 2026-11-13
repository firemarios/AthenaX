# Fixes for evaluation — Πλάνο για ~95/100

> Στόχος: από **75.6/100** (A 8.2 · B 6.8 · C 7.8) σε **~95/100** (A 9.6 · B 9.4 · C 9.4).
> Αρχή: οι κριτές βαθμολογούν **αποδεδειγμένη** πληρότητα. Κάθε επιπλέον μονάδα πρέπει να
> αντιστοιχεί σε ένα ορατό artifact (URL, report, μετρημένο νούμερο, demo), όχι σε κώδικα που
> δεν φαίνεται.

## Παραδοχές

- Διαθέσιμος χρόνος: **3+ μέρες**.
- Επιτρέπεται **public demo** και **πραγματικό LLM key** (OpenAI-compatible).
- Reviewer: **ομάδα/mentor** — άρα V1 είναι εγγυημένο, V2 μόνο αν βρεθεί benchmark.

---

## Μέρα 1 — Πρωί: Phase 0, «αποδεικνύεται ότι τρέχει»

| Task | Files | Acceptance |
|---|---|---|
| CI gates | `.github/workflows/ci.yml` | `pytest`, `ruff`, `npm run lint`, `typecheck`, `build` πράσινα + badge στο README |
| E2E smoke | `infrastructure/deployment/smoke.ps1` | Μία εντολή: ingest → ask → policy → simulate → impact → export, με assertions σε envelope/passport |
| Connector health | `scripts/connector_health.py` → `docs/evidence/connector-health.md` | Πίνακας status+latency για 9 πηγές, με timestamp |
| Metrics | `apps/api/app/main.py` `GET /metrics` (plain text, χωρίς deps) | request count, latency, connector up/down |

## Μέρα 1 — Απόγευμα: Phase 1, πραγματικά δεδομένα στα simulations (A +3.5)

Το κενό είναι συγκεκριμένο: `services/simulation_engine/runner.py:115` δέχεται `snapshot`, αλλά
`apps/api/app/api/v1/simulations.py:105` καλεί `run_model` χωρίς αυτό.

1. **`services/data_ingestion/snapshot.py`**
   - `build_snapshot(area_id)` → `{parks, facilities, population_points, observed, sources[], retrieved_at, mode}`
   - Πηγή: `city_features` (DB) για `green_spaces`/`schools`/`hospitals`/`public_facilities`/`population`,
     με bbox από `city_areas`.
   - Fallback: live Overpass για parks/facilities αν η DB είναι κενή· τελικό fallback synthetic
     (έντιμο flag).
2. **`apps/api/app/api/v1/simulations.py`**: `snapshot = await build_snapshot(area)` →
   `run_model(..., snapshot=snapshot)`; αποθήκευση `snapshot_mode` στο run.
3. **Ingest → city_features**: χαρτογράφηση Overpass layers στο
   `admin_repo.persist_ingest_records` ώστε το Digital Twin να γεμίζει από πραγματικά OSM
   (σήμερα μόνο demo seed).
4. **UI badge**: `snapshot` vs `synthetic` στο `simulations/[id]` και στο passport.
5. **Έλεγχος ΚΗΜΔΗΣ/ΕΛΣΤΑΤ**: πραγματικό endpoint ή έντιμο `degraded`.

**Acceptance:** run σε Exarchia → `mode=snapshot`, passport με ≥1 πραγματικό source URL +
`retrieved_at`, ίδια metrics με ίδιο seed.

## Μέρα 2 — Phase 2, impact & business evidence (B +3.5)

1. **`research/validation/greenspace-v1.0.0.md`** — **V1 εγγυημένο** (named mentor reviewer,
   assumptions, determinism, failure modes). **V2 stretch** μόνο αν βρεθεί benchmark
   (WHO/EEA m²/κάτοικο ή επίσημο Αθηναϊκό στατιστικό).
2. **`scripts/validate_model.py`**: sensitivity sweep + παραγωγή πινάκων του report (stdlib).
3. **`docs/business-model.md`**: adoption ανά Lead Partner, κόστος hosting/έτος, procurement
   path, 12-μηνη roadmap, quantified reach (δήμοι/πληθυσμός).
4. **Pilot**: `docs/pilot/` + `research/reports/pilot-2026-11.md` — **n=6–8 εσωτερικοί/mentor
   testers**, δηλωμένο ως internal usability pilot (όχι «citizen pilot»).
5. **Reach metrics**: `services/reporting_engine/impact.py` + `apps/api/app/api/v1/impact.py`
   → block `reach {population, area_km2, facilities}` από το snapshot.

**Acceptance:** το report ανοίγει και διαβάζεται αυτόνομα· το business doc απαντά σε «ποιος το
πληρώνει και πώς μπαίνει σε δήμο».

## Μέρα 3 — Phase 3 + 4, innovation proof & deployment

1. **AI eval**: `research/experiments/ai_golden_set.json` (20 ελληνικές ερωτήσεις) +
   `scripts/ai_eval.py` → source-hit rate, σωστό `insufficient data`, 0 unsourced claims.
   Τρέχει με το **πραγματικό LLM key**.
2. **«Reproduce» button**: προσθήκη `seed` στο `SimulationCreate`, ώστε το UI να ξανατρέχει με
   ίδιο seed και να συγκρίνει `inputs_checksum` + metrics.
3. **Provenance chain** component (`apps/web/app/_shared`): dataset → AI source → policy →
   passport → impact.
4. **Tornado chart** στο `apps/web/app/impact/[id]/page.tsx`.
5. **BYO city**: `data/source-registry/catalog.berlin.yaml` + docs.
6. **Deploy**: web Vercel, API Render/Fly, PostGIS Neon/Supabase· προσοχή
   `NEXT_PUBLIC_API_BASE_URL` είναι build-time.
7. **`docs/DEMO.md`** + 90" video + 6 slides (1 slide ανά sub-criterion).

**Acceptance:** public URL τρέχει το flagship journey· το AI eval δίνει μετρήσιμο νούμερο· το
«Reproduce» επιστρέφει ταυτόσημα metrics.

## Μέρα 4 — Hardening & rehearsal

- Ξανά όλα τα gates· fix flaky tests· freeze code.
- Dry run παρουσίασης με χρονόμετρο· backup video και local demo σε περίπτωση που πέσει
  δίκτυο/LLM.
- Έλεγχος ότι κάθε claim στο slide έχει απόδειξη στο repo.

---

## Πίνακας αποδείξεων προς κριτές

| Κριτήριο | Artifact που βλέπει ο κριτής |
|---|---|
| A: ολοκλήρωση | CI badge, smoke script, public URL, `/metrics`, connector health report |
| A: 3rd-party | passport με πραγματικά source URLs + `mode=snapshot` |
| B: άμεση εφαρμογή | `docs/business-model.md` + Docker one-liner + demo URL |
| B: impact/πληρότητα | V1 validation report, pilot report, reach metrics, 6-dimension impact |
| C: καινοτομία | AI eval metrics, provenance chain, «Reproduce» checksum, BYO-city config |

## Πρόβλεψη score

| Σενάριο | A | B | C | Σύνολο |
|---|---|---|---|---|
| Σήμερα | 8.2 | 6.8 | 7.8 | 75.6 |
| Phase 0+1 | 9.4 | 7.5 | 8.0 | 85.6 |
| +Phase 2 | 9.5 | 9.2 | 8.2 | 91.6 |
| +Phase 3+4 | 9.6 | 9.4 | 9.4 | **94.8** |

Αν ο χρόνος είναι <2 μέρες: **0 + 1 + 2.1 + 2.3 + 4**. Καμία αλλαγή δεν απαιτεί νέες
dependencies, άρα δεν σπάει το contract «no new deps».

## Ρίσκα & mitigations

- **Live connectors πέφτουν στο demo** → pre-warm + snapshot fallback + backup video.
- **LLM latency/cost** → μικρό `max_tokens`, timeout, fallback answer (υπάρχει ήδη).
- **V2 benchmark δεν βρεθεί** → μένουμε σε V1 με named mentor, δηλωμένο έντιμα.
- **PostGIS σε free tier** → Neon/Supabase με ενεργό `postgis` extension· αλλιώς SQLite demo mode.
