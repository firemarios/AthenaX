"""AI evaluation of citizen proposals (module 07).

Turns a free-text citizen proposal into a short, decision-useful bilingual
assessment (score, criteria, strengths, risks, suggestions). The evaluator is
defensive: if the LLM is unavailable it returns a deterministic heuristic
evaluation, so the feature always works.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

from services.ai_engine.policy_planner import _localized, _parse_json_answer
from services.ai_engine.providers import get_provider

logger = logging.getLogger("athenax.ai.proposal_evaluator")

EVALUATOR_TIMEOUT_SECONDS = 90.0
MAX_CACHE_ENTRIES = 256

_CRITERIA: tuple[tuple[str, dict[str, str]], ...] = (
    ("clarity", {"el": "Σαφήνεια", "en": "Clarity"}),
    ("feasibility", {"el": "Εφικτότητα", "en": "Feasibility"}),
    ("impact", {"el": "Αντίκτυπος", "en": "Impact"}),
    ("equity", {"el": "Δικαιοσύνη", "en": "Equity"}),
    ("cost", {"el": "Κόστος", "en": "Cost"}),
)
_CRITERIA_KEYS = {key for key, _ in _CRITERIA}
_VERDICTS = ("strong", "promising", "needs_work", "unclear")

EVALUATOR_SYSTEM_PROMPT = """You are AthenaX's proposal evaluator for the City of Athens.
You receive one citizen proposal (title, description, area, category). Evaluate it
as a municipal analyst would: is it clear, feasible, impactful, fair and affordable?

Return ONLY a JSON object with this shape:
{
  "score": 0,
  "verdict": "strong | promising | needs_work | unclear",
  "summary": {"el": "...", "en": "..."},
  "criteria": [
    {"key": "clarity | feasibility | impact | equity | cost",
     "score": 0, "note": {"el": "...", "en": "..."}}
  ],
  "strengths": [{"el": "...", "en": "..."}],
  "risks": [{"el": "...", "en": "..."}],
  "suggestions": [{"el": "...", "en": "..."}]
}

Rules:
- The overall score is 0-100; each criterion is 0-100.
- Judge only the proposal text. Never invent budget figures, studies or approvals.
- Be specific: point to what the proposal says, not generic advice.
- Keep summary to 2 sentences, 2-4 items per list, and one entry per criterion.
- Use the proposal's language for "el" when it is Greek; otherwise translate.
- Do not include markdown fences or prose outside the JSON object.
"""

_CACHE: dict[str, dict[str, Any]] = {}


def _proposal_text(proposal: dict[str, Any]) -> str:
    return " ".join(
        str(proposal.get(key) or "")
        for key in ("title", "description", "area", "category")
    ).strip()


def _cache_key(proposal: dict[str, Any]) -> str:
    blob = _proposal_text(proposal)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _score(value: Any, default: int) -> int:
    number = _num(value)
    if number is None:
        return default
    return max(0, min(100, int(round(number))))


def _verdict(score: int, value: Any = None) -> str:
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in _VERDICTS:
            return cleaned
    if score >= 75:
        return "strong"
    if score >= 55:
        return "promising"
    if score >= 35:
        return "needs_work"
    return "unclear"


def _normalise_criteria(raw: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or "").strip().lower()
            if key not in _CRITERIA_KEYS or key in by_key:
                continue
            default_score = next(
                (entry["score"] for entry in fallback if entry["key"] == key), 50
            )
            label = next(label for k, label in _CRITERIA if k == key)
            by_key[key] = {
                "key": key,
                "label": label,
                "score": _score(item.get("score"), default_score),
                "note": _localized(item.get("note")),
            }
    for entry in fallback:
        by_key.setdefault(entry["key"], entry)
    return [by_key[key] for key, _ in _CRITERIA]


def _normalise_list(value: Any, fallback: list[dict[str, str]]) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return fallback
    items: list[dict[str, str]] = []
    for item in value:
        localized = _localized(item)
        if localized["en"] and localized not in items:
            items.append(localized)
    return items[:4] or fallback


def _heuristic(proposal: dict[str, Any]) -> dict[str, Any]:
    title = str(proposal.get("title") or "").strip()
    description = str(proposal.get("description") or "").strip()
    area = str(proposal.get("area") or "").strip()
    category = str(proposal.get("category") or "").strip()
    text = f"{title} {description}".lower()

    length = len(description)
    clarity = 40
    if len(title) >= 8:
        clarity += 15
    if length >= 80:
        clarity += 15
    if length >= 240:
        clarity += 15
    if any(ch.isdigit() for ch in description):
        clarity += 5

    feasibility = 45
    if area:
        feasibility += 15
    if category:
        feasibility += 10
    if any(
        word in text
        for word in (
            "βήμα", "στάδιο", "υλοποί", "χρονοδιάγραμμα", "μελέτη", "συνεργασία",
            "προϋπολογισμ", "κόστος", "δήμος", "υπηρεσί", "step", "phase", "plan",
            "budget", "timeline", "pilot", "study",
        )
    ):
        feasibility += 20
    feasibility = min(100, feasibility)

    impact = 40
    impact_terms = (
        "πράσινο", "δέντρ", "πεζοδρ", "πεζοδρομ", "ποδήλατ", "κυκλοφορ", "σχολ",
        "παιδ", "ηλικιωμ", "αναπηρ", "προσβασ", "ασφάλεια", "φωτισμ", "κάδο",
        "ανακύκλωσ", "στάθμευσ", "πάρκ", "πλατεί", "γειτονι", "green", "tree",
        "sidewalk", "pedestrian", "bike", "traffic", "school", "children",
        "accessib", "safety", "lighting", "waste", "recycl", "parking", "park",
    )
    matches = sum(1 for term in impact_terms if term in text)
    impact += min(40, matches * 12)
    if length >= 200:
        impact += 10
    impact = min(100, impact)

    equity = 45
    equity_terms = (
        "όλοι", "όλες", "κατοίκ", "γειτονι", "εύπορ", "αστέγ", "μετανάστ", "ηλικιωμ",
        "παιδι", "αναπηρ", "προσβασ", "μειονεκτ", "ευάλωτ", "residents", "everyone",
        "vulnerable", "elderly", "children", "disab", "accessib", "low-income",
    )
    if any(term in text for term in equity_terms):
        equity += 25
    if area:
        equity += 10
    equity = min(100, equity)

    cost = 50
    if any(term in text for term in ("προϋπολογισμ", "κόστος", "χρηματοδ", "budget", "cost", "fund")):
        cost += 20
    if any(term in text for term in ("δωρε", "εθελοντ", "χορηγ", "donat", "volunteer", "sponsor")):
        cost += 10
    if length < 80:
        cost -= 10
    cost = max(0, min(100, cost))

    scores = {
        "clarity": min(100, clarity),
        "feasibility": feasibility,
        "impact": impact,
        "equity": equity,
        "cost": cost,
    }
    total = round(
        scores["clarity"] * 0.2
        + scores["feasibility"] * 0.25
        + scores["impact"] * 0.25
        + scores["equity"] * 0.15
        + scores["cost"] * 0.15
    )
    total = max(0, min(100, total))

    notes = {
        "clarity": {
            "el": "Ο τίτλος και η περιγραφή δίνουν αρκετή πληροφορία." if clarity >= 60
            else "Η πρόταση χρειάζεται πιο συγκεκριμένη διατύπωση.",
            "en": "The title and description carry enough detail." if clarity >= 60
            else "The proposal needs a more specific wording.",
        },
        "feasibility": {
            "el": "Υπάρχουν στοιχεία υλοποίησης και αρμόδιος φορέας." if feasibility >= 60
            else "Λείπουν βήματα υλοποίησης, χρονοδιάγραμμα ή αρμόδιος φορέας.",
            "en": "Implementation cues and an owner are present." if feasibility >= 60
            else "Implementation steps, timeline or owner are missing.",
        },
        "impact": {
            "el": "Το θέμα αγγίζει καθημερινές ανάγκες της γειτονιάς." if impact >= 60
            else "Ο αναμενόμενος αντίκτυπος δεν περιγράφεται καθαρά.",
            "en": "The topic touches everyday neighbourhood needs." if impact >= 60
            else "The expected impact is not described clearly.",
        },
        "equity": {
            "el": "Η πρόταση αναφέρεται σε ευρύτερη ομάδα ωφελούμενων." if equity >= 60
            else "Δεν προσδιορίζεται ποιοι ωφελούνται περισσότερο.",
            "en": "The proposal addresses a broad group of beneficiaries." if equity >= 60
            else "It does not identify who benefits most.",
        },
        "cost": {
            "el": "Υπάρχουν ενδείξεις για το κόστος ή τη χρηματοδότηση." if cost >= 60
            else "Το κόστος και η χρηματοδότηση δεν έχουν εκτιμηθεί.",
            "en": "There are cues about cost or funding." if cost >= 60
            else "Cost and funding are not estimated.",
        },
    }

    strengths: list[dict[str, str]] = []
    risks: list[dict[str, str]] = []
    suggestions: list[dict[str, str]] = []
    if scores["clarity"] >= 60:
        strengths.append({
            "el": "Κατανοητή διατύπωση του αιτήματος.",
            "en": "The request is easy to understand.",
        })
    else:
        risks.append({
            "el": "Η περιγραφή είναι σύντομη ή αόριστη.",
            "en": "The description is short or vague.",
        })
        suggestions.append({
            "el": "Προσθέστε τόπο, έκταση και αναμενόμενο αποτέλεσμα.",
            "en": "Add the location, scale and expected outcome.",
        })
    if scores["feasibility"] >= 60:
        strengths.append({
            "el": "Υπάρχουν στοιχεία που δείχνουν πρακτική υλοποίηση.",
            "en": "There are cues pointing to practical implementation.",
        })
    else:
        risks.append({
            "el": "Δεν φαίνεται ποιος φορέας θα το υλοποιήσει ή με ποια σειρά.",
            "en": "It is unclear which body delivers it and in what order.",
        })
        suggestions.append({
            "el": "Ορίστε αρμόδια υπηρεσία και ένα πρώτο βήμα (π.χ. μελέτη).",
            "en": "Name the responsible service and a first step (e.g. a study).",
        })
    if scores["impact"] >= 60:
        strengths.append({
            "el": "Η πρόταση συνδέεται με αισθητές καθημερινές ανάγκες.",
            "en": "The proposal connects to tangible everyday needs.",
        })
    if scores["equity"] >= 60:
        strengths.append({
            "el": "Αναφέρεται σε ομάδες ή σε ολόκληρη τη γειτονιά.",
            "en": "It addresses groups or the whole neighbourhood.",
        })
    if scores["cost"] < 60:
        suggestions.append({
            "el": "Δώστε ένα εύρος κόστους ή πηγή χρηματοδότησης.",
            "en": "Provide a cost range or a funding source.",
        })

    if not suggestions:
        suggestions.append({
            "el": "Συνδέστε την πρόταση με ένα σενάριο για προσομοίωση επιπτώσεων.",
            "en": "Link the proposal to a scenario for impact simulation.",
        })

    summary = {
        "el": (
            f"Πρόταση «{title or 'χωρίς τίτλο'}»"
            + (f" για {area}" if area else "")
            + ". Η αξιολόγηση είναι ενδεικτική και βασίζεται μόνο στο κείμενο."
        ),
        "en": (
            f"Proposal \"{title or 'untitled'}\""
            + (f" for {area}" if area else "")
            + ". This assessment is indicative and based only on the text."
        ),
    }

    return {
        "ai_used": False,
        "score": total,
        "verdict": _verdict(total),
        "summary": summary,
        "criteria": [
            {
                "key": key,
                "label": label,
                "score": scores[key],
                "note": notes[key],
            }
            for key, label in _CRITERIA
        ],
        "strengths": strengths[:4],
        "risks": risks[:4],
        "suggestions": suggestions[:4],
    }


def _normalise_evaluation(
    payload: dict[str, Any], fallback: dict[str, Any]
) -> dict[str, Any]:
    score = _score(payload.get("score"), fallback["score"])
    summary = _localized(payload.get("summary"))
    if not summary["en"]:
        summary = fallback["summary"]
    return {
        "ai_used": True,
        "score": score,
        "verdict": _verdict(score, payload.get("verdict")),
        "summary": summary,
        "criteria": _normalise_criteria(payload.get("criteria"), fallback["criteria"]),
        "strengths": _normalise_list(payload.get("strengths"), fallback["strengths"]),
        "risks": _normalise_list(payload.get("risks"), fallback["risks"]),
        "suggestions": _normalise_list(payload.get("suggestions"), fallback["suggestions"]),
    }


async def evaluate_proposal(
    proposal: dict[str, Any],
    *,
    provider: Any = None,
    timeout: float = EVALUATOR_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Evaluate one proposal with AI, falling back to deterministic heuristics."""
    fallback = _heuristic(proposal)
    key = _cache_key(proposal)
    cached = _CACHE.get(key)
    if cached is not None:
        return dict(cached)

    try:
        active_provider = provider
        if active_provider is None:
            from app.config import get_settings

            active_provider = get_provider(get_settings())

        prompt = {
            "title": proposal.get("title"),
            "description": proposal.get("description"),
            "area": proposal.get("area"),
            "category": proposal.get("category"),
            "heuristic_draft": {
                "score": fallback["score"],
                "criteria": [
                    {"key": entry["key"], "score": entry["score"]}
                    for entry in fallback["criteria"]
                ],
            },
        }
        messages = [
            {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False, default=str)},
        ]
        content = await asyncio.wait_for(
            active_provider.chat(messages, temperature=0.2, max_tokens=2000),
            timeout=timeout,
        )
        payload = _parse_json_answer(content)
        if not isinstance(payload, dict):
            raise ValueError("invalid JSON from proposal evaluator")

        evaluation = _normalise_evaluation(payload, fallback)
        _remember(key, evaluation)
        return dict(evaluation)
    except Exception as exc:  # noqa: BLE001 — the feature must keep working
        logger.warning("proposal evaluator fallback: %s", exc)
        return dict(fallback)


def _remember(key: str, evaluation: dict[str, Any]) -> None:
    if len(_CACHE) >= MAX_CACHE_ENTRIES:
        _CACHE.clear()
    _CACHE[key] = dict(evaluation)


__all__ = ["evaluate_proposal"]
