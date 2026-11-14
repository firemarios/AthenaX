# Business model — who pays, and how a municipality adopts POLICYLAB

> Purpose: answer the evaluator's question **"who pays for this and how does it get into a
> city?"** with concrete numbers, a procurement path and a 12-month plan. No invented
> customers: every figure below is either a public statistic or a quoted cloud list price,
> and assumptions are labelled.

---

## 1. Value proposition in one paragraph

POLICYLAB turns open data and GovTech records into a **defensible policy workflow**: ask a
question and get an answer with sources or an explicit "insufficient data"; turn a proposal
into a deterministic simulation with a full passport; compare baseline vs scenario; produce a
6-dimension impact report; and export a research dossier. The buyer is not paying for a
dashboard — they are paying for **traceable evidence they can defend in a council meeting or
an audit**.

---

## 2. Who pays (Lead Partners)

| Lead partner (role) | What they buy | Why they buy it | Budget line |
|---|---|---|---|
| **Δήμος Αθηναίων — Office of Resilience / Digital Governance** | Annual licence for 3-10 analysts, Athens data pack, onboarding | Policy teams already run consultations and climate/social plans; they need quantified ex-ante evidence | Digital transformation / operational programme |
| **Region of Attica — Planning Directorate** | Regional workspace, multi-municipality comparison, BYO-city pack | Needs a common evidence base across municipalities for EU-funded programmes | Regional operational programme (ESPA/NSRF) |
| **University / research lab (e.g. urban planning, public policy)** | Research licence + reproducible exports + methodology | Needs auditable, citable simulations with deterministic seeds and passports | Research grant / department budget |
| **NGO / civic-tech partner** | Citizen-lab package, training | Runs participatory budgeting and neighbourhood consultations | Foundation grant / CSR |
| **Integrator / consultancy** | White-label deployment + support | Delivers GovTech projects to municipalities without building the stack | Project budget |

**Commercial model:** annual subscription per workspace, not per seat, with an open-source
core (Apache-2.0). Indicative price ladder (to validate with the first two Lead Partners):

| Tier | Annual price (indicative) | Includes |
|---|---|---|
| Community (self-hosted) | €0 | Apache-2.0 code, Docker Compose, docs, no support SLA |
| Municipality | €9,000 – €18,000 / year | Hosted workspace, 5-10 named users, onboarding, quarterly data refresh, 5-day support |
| Region / multi-city | €25,000 – €45,000 / year | Multi-tenant, 3-8 municipalities, BYO-city configuration, annual validation review |
| Research / NGO | €3,000 – €6,000 / year | Hosted workspace, exportable evidence, methodology support |

These are **prices to test**, not signed contracts. The open core removes lock-in and makes
the paid layer about hosting, curation, validation and support.

---

## 3. Cost to operate (per year, list prices, November 2026)

| Item | Free/dev | Small production | Notes |
|---|---|---|---|
| API hosting (Render/Fly) | €0 | €300 – €900 / yr | 1 shared CPU, 512 MB-1 GB, autoscale off |
| Postgres + PostGIS (Neon/Supabase) | €0 | €0 – €240 / yr | Free tier is enough for a pilot; paid tier for backups |
| Web hosting (Vercel) | €0 | €0 – €240 / yr | Hobby/Pro |
| Object storage (S3/R2) | €0 | €60 – €180 / yr | Ingest snapshots |
| LLM API (OpenAI-compatible) | pay-per-use | €600 – €2,400 / yr | ~2,000-8,000 answers/year at small `max_tokens`; fallback answer exists when unavailable |
| Domain, email, monitoring | €0 | €100 – €250 / yr | |
| **Total** | **≈ €0** | **≈ €1,000 – €4,200 / yr** | Before staff time |

The pilot can run on **€0** cloud spend (SQLite demo mode + free tiers) and degrades
honestly: every connector down is visible in `/metrics` and the connector health report.

Staff effort for a municipality: ~0.2 FTE analyst for content curation, ~0.1 FTE IT liaison.
No dedicated data engineer is required for the pilot.

---

## 4. Procurement path (Greece)

1. **Pilot / proof of value (0-3 months).** Direct award below the Greek low-value threshold
   (currently **€30,000** for services — verify against the applicable ΚΥΑ/ΕΑΑΔΗΣΥ rules and
   the municipality's internal regulation). Deliverables: hosted pilot, training, evidence
   report. This is the realistic entry point.
2. **Controlled tender (3-9 months).** For €30,000-€60,000, a negotiated procedure with
   published technical specifications. POLICYLAB's open code and public docs make the
   specification easy to write and hard to lock in.
3. **Open tender (9-12+ months).** Above national/EU thresholds, published in ΕΣΗΔΗΣ. The
   Apache-2.0 licence and reproducible exports are scored as transparency/innovation.
4. **Procurement artefacts provided by this repository:** technical specification
   (`docs/architecture/technical-specification.md`), data-governance note
   (`docs/data-governance/README.md`), deployment guide (`docs/DEPLOY.md`), demo script
   (`docs/DEMO.md`), validation report (`research/validation/greenspace-v1.0.0.md`).

**Framework option:** a Region or a central body can procure once and offer instances to its
municipalities, cutting per-city procurement cost.

---

## 5. Quantified reach (public statistics)

- **Δήμος Αθηναίων:** 643,452 residents (ΕΛΣΤΑΤ, 2021 Census).
- **Attica Region:** 3,792,469 residents (ΕΛΣΤΑΤ, 2021 Census), 66 municipalities.
- **Pilot wedge:** 6 seeded Athens neighbourhoods (`city_areas`), ~0.8-1.6 km² each.

If the Athens package is adopted by the municipality and offered to Attica municipalities,
the addressable population is **~3.8 M residents** across **66 municipalities**. A realistic
12-month goal is **1 lead municipality + 2-3 follower municipalities** (≈ 0.8-1.2 M
residents), not all 66.

All reach numbers are derived from the source registry and are shown in the product itself:
`GET /v1/impact/{run_id}` returns a `reach` block (population, area_km², facilities) computed
from the same snapshot that fed the simulation.

---

## 6. 12-month roadmap

| Quarter | Milestone | Evidence produced |
|---|---|---|
| Q1 | Two Lead Partner pilots (Athens + one research/NGO), onboarding, first policy dossier | Signed pilot MoUs, `research/reports/pilot-2026-11.md`, first exported dossier |
| Q1-Q2 | Data curation: ELSTAT/ΚΗΜΔΗΣ connectors hardened, city_features populated for the 6 areas | Connector health report, `mode=snapshot` runs for every area |
| Q2 | Validation V1 → V1.1: honest review of greenspace/accessibility assumptions with a mentor; add benchmark comparison when a citable benchmark is found | `research/validation/greenspace-v1.0.0.md` + change log |
| Q3 | Multi-city (BYO city): second city config + deployment in a Region sandbox | `data/source-registry/catalog.berlin.yaml`, deployment guide |
| Q3-Q4 | Procurement: publish technical spec + price ladder, respond to one controlled tender | Tender pack, cost model |
| Q4 | Sustainability: 2 paid municipality subscriptions, support SLA, quarterly release train | Signed contracts, SLA, release notes |

---

## 7. Honest risks

- **Adoption risk:** a pilot can succeed technically and still not convert. Mitigation: define
  the success metric with the Lead Partner up front (time-to-evidence, number of dossiers).
- **Data risk:** Greek open-data APIs are uneven. Mitigation: snapshot fallbacks are visible,
  not hidden; `mode=synthetic` is part of the passport.
- **Procurement risk:** thresholds and procedures change. Mitigation: the open core allows a
  direct-award pilot without procurement.
- **Model risk:** models are deliberately simple. Mitigation: validation report, declared
  assumptions, sensitivity tables, and never claiming causality.

---

## 8. Why this is defensible

1. **Open core, paid operations** — no vendor lock-in, procurement-friendly.
2. **Evidence artifacts are the product** — passport, checksum, impact report, export.
3. **The same stack serves a municipality and a research lab** — one codebase, two buying
   centres.
4. **Costs are small enough for a pilot** (≈ €1-4k/year cloud) and scale only with adoption.
