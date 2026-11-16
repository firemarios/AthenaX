"""Audit that every pitch-deck claim has verifiable evidence in the repo.

Day 4 asks for "every claim on the slides has proof in the repo". This script
walks the six-slide deck, checks the artifacts it points at (files, CI steps,
generated metrics), and writes docs/evidence/claims-audit.md. Exit code is
non-zero if any claim is unverifiable.

Run: python scripts/claims_audit.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "evidence" / "claims-audit.md"
DECK = "docs/slides/pitch-6-slides.md"


def text(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def main() -> int:
    checks: list[tuple[str, str, bool, str]] = []

    def check(claim: str, evidence: str, ok: bool, note: str = "") -> None:
        checks.append((claim, evidence, bool(ok), note))

    def exists(claim: str, rel: str) -> None:
        check(claim, rel, (ROOT / rel).exists())

    def contains(claim: str, rel: str, needle: str, *, lower: bool = False) -> None:
        path = ROOT / rel
        haystack = text(rel) if path.exists() else ""
        if lower:
            ok = needle.lower() in haystack.lower()
        else:
            ok = needle in haystack
        check(claim, rel, ok, f"expected `{needle}`")

    # Slide 1 - product and normative docs
    for rel in ("README.md", "docs/PRD.md", "docs/architecture/contracts.md"):
        exists("Public product and contract docs", rel)
    contains("API-first envelope contract documented", "docs/architecture/contracts.md", "/v1")

    # Slide 2 - it runs, and we prove it
    contains("CI runs pytest", ".github/workflows/ci.yml", "pytest")
    contains("CI runs ruff", ".github/workflows/ci.yml", "ruff check .")
    contains("CI runs frontend lint", ".github/workflows/ci.yml", "npm run lint")
    contains("CI runs frontend typecheck", ".github/workflows/ci.yml", "npm run typecheck")
    contains("CI runs frontend build", ".github/workflows/ci.yml", "npm run build")
    contains("Backend suite result recorded", "docs/evidence/rehearsal.md", "85 passed")
    contains("E2E smoke result recorded", "docs/evidence/smoke.md", "SMOKE PASSED (21 checks)")
    contains("Timed dry run recorded", "docs/evidence/dry-run.md", "SMOKE PASSED (21 checks)")
    contains("Connector health report exists", "docs/evidence/connector-health.md", "Sources checked: **11**")
    contains(
        "Connector degradations are documented",
        "docs/evidence/connector-health.md",
        "Known limitations",
    )
    exists("Prometheus metrics endpoint exists", "apps/api/app/metrics.py")
    contains("Metrics endpoint wired", "apps/api/app/main.py", "/metrics")
    exists("E2E smoke script exists", "infrastructure/deployment/smoke.ps1")

    # Slide 3 - third-party data with visible provenance
    exists("Snapshot builder exists", "services/data_ingestion/snapshot.py")
    contains("Snapshot exposes source URLs", "services/data_ingestion/snapshot.py", "https://www.openstreetmap.org")
    contains("Snapshot labels synthetic fallback", "services/data_ingestion/snapshot.py", "synthetic")
    contains("Snapshot mode recorded in evidence", "docs/evidence/smoke.md", "mode=snapshot")
    contains("Passport carries an inputs checksum", "services/simulation_engine/runner.py", "inputs_checksum")

    # Slide 4 - adoption, pricing, deployment
    contains("Municipality entry price", "docs/business-model.md", "9,000")
    contains("Municipality upper price", "docs/business-model.md", "18,000")
    contains("Direct-award threshold", "docs/business-model.md", "30,000")
    contains("Athens reach", "docs/business-model.md", "643,452")
    contains("Attica reach", "docs/business-model.md", "3,792,469")
    contains("Municipality count", "docs/business-model.md", "66")
    contains("Docker deployment path", "docs/DEPLOY.md", "docker compose")
    contains("Build-time API URL documented", "docs/DEPLOY.md", "NEXT_PUBLIC_API_BASE_URL")
    exists("Demo script exists", "docs/DEMO.md")

    # Slide 5 - impact, validation, pilot honesty
    contains("Six-dimension impact recorded", "docs/evidence/smoke.md", "6 dimensions")
    contains("Reach block recorded", "docs/evidence/smoke.md", "reach")
    contains("Tornado chart exists", "apps/web/app/impact/[id]/page.tsx", "SensitivityTornado")
    contains("V2 benchmark not claimed", "research/validation/greenspace-v1.0.0.md", "not claimed", lower=True)
    contains("Pilot results marked pending", "research/reports/pilot-2026-11.md", "_pending_")
    contains("Determinism uses a fixed seed", "docs/evidence/model-sensitivity.md", "seed=42")

    # Slide 6 - innovation proof
    eval_path = ROOT / "docs/evidence/ai-eval.json"
    eval_ok = False
    eval_note = "missing ai-eval.json"
    if eval_path.exists():
        result = json.loads(eval_path.read_text(encoding="utf-8"))
        eval_ok = (
            result.get("total") == 20
            and result.get("source_hit_rate") == 1.0
            and result.get("insufficient_correct_rate") == 1.0
            and result.get("unsourced_claims") == 0
            and result.get("over_refusal_rate") == 0.6667
        )
        eval_note = (
            f"source={result.get('source_hit_rate')} "
            f"refusals={result.get('insufficient_correct_rate')} "
            f"unsourced={result.get('unsourced_claims')} "
            f"over_refusal={result.get('over_refusal_rate')}"
        )
    check("AI eval numbers match the slide", "docs/evidence/ai-eval.json", eval_ok, eval_note)
    contains(
        "Over-refusal reported as a diagnostic",
        "docs/evidence/ai-eval.md",
        "not gating",
    )
    contains("Over-refusal remediation documented", "docs/evidence/ai-eval-notes.md", "remediation", lower=True)
    contains("Provenance chain exists", "apps/web/app/simulations/[id]/page.tsx", "ProvenanceChain")
    contains("Reproduce control exists", "apps/web/app/simulations/[id]/page.tsx", "Reproduce (same seed)")
    contains("Catalog override is wired", "apps/api/app/repositories/sources.py", "ATHENAX_CATALOG_FILE")

    berlin_ok = False
    berlin_note = "missing catalog.berlin.yaml"
    berlin_path = ROOT / "data/source-registry/catalog.berlin.yaml"
    if berlin_path.exists():
        data = yaml.safe_load(berlin_path.read_text(encoding="utf-8"))
        areas = data.get("city_areas") or []
        source_names = {item.get("name") for item in data.get("sources") or []}
        berlin_ok = (
            (data.get("city") or {}).get("id") == "berlin"
            and len(areas) >= 6
            and {"ckan", "overpass", "eurostat"} <= source_names
        )
        berlin_note = f"areas={len(areas)} sources={sorted(source_names)}"
    check("Second city pack is valid", "data/source-registry/catalog.berlin.yaml", berlin_ok, berlin_note)

    # Deck structure itself
    deck_path = ROOT / DECK
    deck = deck_path.read_text(encoding="utf-8") if deck_path.exists() else ""
    slides = re.findall(r"^## Slide \d", deck, re.MULTILINE)
    check("Six slides present", DECK, len(slides) == 6, f"found {len(slides)}")
    contains("Deck keeps the honesty line", DECK, "pending", lower=True)

    passed = sum(1 for _, _, ok, _ in checks if ok)
    failed = len(checks) - passed
    generated = datetime.now(timezone.utc).isoformat()

    lines = [
        "# Claims audit - slides to repo evidence",
        "",
        f"- Generated: **{generated}**",
        f"- Deck: [`{DECK}`](../slides/pitch-6-slides.md)",
        f"- Checks: **{len(checks)}** - passed **{passed}** - failed **{failed}**",
        f"- Result: **{'PASS' if failed == 0 else 'FAIL'}**",
        "",
        "| # | Claim | Evidence | Result | Detail |",
        "|---|---|---|---|---|",
    ]
    for index, (claim, evidence, ok, note) in enumerate(checks, start=1):
        lines.append(
            f"| {index} | {claim} | `{evidence}` | **{'ok' if ok else 'MISSING'}** | {note} |"
        )
    lines.extend(
        [
            "",
            "## Reproduce",
            "",
            "```bash",
            "python scripts/claims_audit.py",
            "```",
            "",
            "The audit fails (exit 1) if any claim loses its evidence, so the deck and the repo",
            "cannot drift apart silently.",
        ]
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{passed}/{len(checks)} claims verified; wrote {OUTPUT}")
    if failed:
        for claim, evidence, ok, note in checks:
            if not ok:
                print(f"  MISSING: {claim} -> {evidence} ({note})")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
