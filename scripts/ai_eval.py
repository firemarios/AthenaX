"""Evidence-first AI evaluation (Phase 3, C).

Runs the 20-question Greek golden set against a live API and measures:
  - source-hit rate on questions that should be answerable;
  - correct "insufficient data" behaviour on questions that must be refused;
  - unsourced claims (non-insufficient answers with zero sources) — target: 0.

Usage:
    python scripts/ai_eval.py --base-url http://127.0.0.1:8000
    python scripts/ai_eval.py --dry-run          # validate the golden set only

Requires a running API and a real LLM key for a meaningful run. Never invents results:
if the API is unreachable, the script exits non-zero with an error report.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
try:  # Windows consoles default to cp1252; reports are UTF-8.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass


def _post_json(url: str, payload: dict, timeout: float) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - explicit local API
        return json.loads(response.read().decode("utf-8"))


def _load_set(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise SystemExit(f"No questions in {path}")
    for item in questions:
        if not item.get("question") or item.get("expect") not in {"sources", "insufficient"}:
            raise SystemExit(f"Invalid item in {path}: {item!r}")
    return questions


def _source_text(answer: dict) -> str:
    parts = []
    for source in answer.get("sources") or []:
        if isinstance(source, dict):
            parts.append(str(source.get("title") or ""))
            parts.append(str(source.get("url") or ""))
        else:
            parts.append(str(source))
    return " ".join(parts).lower()


def _is_insufficient(answer: dict) -> bool:
    limitations = [str(item).lower() for item in answer.get("limitations") or []]
    return any("insufficient" in item or "ανεπαρκ" in item for item in limitations)


def _keyword_hit(answer: dict, must_include: list[str]) -> bool:
    if not must_include:
        return True
    haystack = _source_text(answer) + " " + str(answer.get("detailed_result") or "").lower()
    return any(str(keyword).lower() in haystack for keyword in must_include)


def evaluate(questions: list[dict], base_url: str, timeout: float) -> dict:
    rows: list[dict] = []
    for item in questions:
        url = f"{base_url.rstrip('/')}/v1/ai/query"
        try:
            envelope = _post_json(
                url,
                {"question": item["question"], "city": item.get("city") or "Athens"},
                timeout,
            )
            answer = envelope.get("data") if isinstance(envelope, dict) else None
            error = None
            if not isinstance(answer, dict):
                answer = {}
                error = "empty answer"
        except Exception as exc:  # noqa: BLE001
            answer = {}
            error = str(exc)
        insufficient = _is_insufficient(answer)
        has_sources = bool(answer.get("sources"))
        row = {
            "id": item["id"],
            "question": item["question"],
            "expect": item["expect"],
            "insufficient": insufficient,
            "sources": len(answer.get("sources") or []),
            "keyword_hit": _keyword_hit(answer, item.get("must_include") or []),
            "unsourced_claim": (not insufficient) and (not has_sources),
            "summary": str(answer.get("summary") or "")[:280],
            "error": error,
        }
        rows.append(row)

    expected_sources = [row for row in rows if row["expect"] == "sources"]
    expected_insufficient = [row for row in rows if row["expect"] == "insufficient"]
    source_hits = [row for row in expected_sources if row["sources"] > 0]
    insufficient_ok = [row for row in expected_insufficient if row["insufficient"]]
    over_refusals = [row for row in expected_sources if row["insufficient"]]
    unsourced = [row for row in rows if row["unsourced_claim"]]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "total": len(rows),
        "source_hit_rate": round(len(source_hits) / len(expected_sources), 4)
        if expected_sources
        else None,
        "insufficient_correct_rate": round(
            len(insufficient_ok) / len(expected_insufficient), 4
        )
        if expected_insufficient
        else None,
        "over_refusal_rate": round(len(over_refusals) / len(expected_sources), 4)
        if expected_sources
        else None,
        "over_refusals": len(over_refusals),
        "unsourced_claims": len(unsourced),
        "rows": rows,
    }


def _markdown(result: dict) -> str:
    source_rate = result["source_hit_rate"]
    insufficient_rate = result["insufficient_correct_rate"]
    lines = [
        "# AI evidence-first evaluation",
        "",
        f"- Generated: **{result['generated_at']}**",
        f"- API: `{result['base_url']}`",
        f"- Questions: **{result['total']}**",
        f"- Source-hit rate (answerable questions): **{source_rate}**",
        f"- Correct insufficient-data rate: **{insufficient_rate}**",
        f"- Unsourced claims (target 0): **{result['unsourced_claims']}**",
        f"- Over-refusal on answerable questions (diagnostic): **{result['over_refusal_rate']}**",
        "",
        "## Pass criteria",
        "",
        "The contract is: every answer either cites at least one retrieved source or explicitly says",
        "the data is insufficient — never an unsourced claim. Over-refusal is reported separately as",
        "a usability/quality signal; it does not make an answer untruthful.",
        "",
        f"- source present on answerable questions ≥ 0.80 → **{'PASS' if (source_rate or 0) >= 0.8 else 'FAIL'}**",
        f"- explicit insufficiency on refusal traps ≥ 0.80 → **{'PASS' if (insufficient_rate or 0) >= 0.8 else 'FAIL'}**",
        f"- unsourced claims == 0 → **{'PASS' if result['unsourced_claims'] == 0 else 'FAIL'}**",
        f"- over-refusal (diagnostic, not gating; target ≤ 0.20) → **WARN ({result['over_refusal_rate']})**"
        if (result["over_refusal_rate"] or 0) > 0.2
        else f"- over-refusal (diagnostic, not gating; target ≤ 0.20) → **OK ({result['over_refusal_rate']})**",
        "",
        "## Per-question results",
        "",
        "| id | expect | sources | insufficient | keyword | unsourced | error |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in result["rows"]:
        lines.append(
            f"| {row['id']} | {row['expect']} | {row['sources']} | {row['insufficient']} | "
            f"{row['keyword_hit']} | {row['unsourced_claim']} | {row['error'] or ''} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate Ask the City on the Greek golden set.")
    parser.add_argument(
        "--set",
        default=str(ROOT / "research" / "experiments" / "ai_golden_set.json"),
        help="Path to the golden set JSON",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--timeout", type=float, default=120.0)
    parser.add_argument(
        "--output",
        default=str(ROOT / "docs" / "evidence" / "ai-eval.md"),
        help="Markdown report path",
    )
    parser.add_argument(
        "--json-output",
        default=str(ROOT / "docs" / "evidence" / "ai-eval.json"),
        help="JSON results path",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate the set without calling the API")
    args = parser.parse_args()

    questions = _load_set(Path(args.set))
    if args.dry_run:
        print(f"Golden set OK: {len(questions)} questions in {args.set}")
        return 0

    result = evaluate(questions, args.base_url, args.timeout)
    report = _markdown(result)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report, encoding="utf-8")
    json_output = Path(args.json_output)
    json_output.parent.mkdir(parents=True, exist_ok=True)
    json_output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(report)
    print(f"\nWritten to {output} and {json_output}")

    passed = (
        (result["source_hit_rate"] or 0) >= 0.8
        and (result["insufficient_correct_rate"] or 0) >= 0.8
        and result["unsourced_claims"] == 0
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
