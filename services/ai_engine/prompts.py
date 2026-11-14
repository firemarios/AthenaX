"""Prompts for Ask the City (contract §4): Greek, strict JSON-only, cite provided sources."""
from __future__ import annotations

import html
import json
import re

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


def _clean_text(value: str) -> str:
    text = html.unescape(_TAG_RE.sub(" ", str(value or "")))
    return _SPACE_RE.sub(" ", text).strip()

SYSTEM_PROMPT = (
    "Είσαι το POLICYLAB, αξιόπιστος βοηθός δημόσιας πολιτικής για ελληνικές πόλεις. "
    "Απάντα ΠΑΝΤΑ με ΕΝΑ μόνο JSON αντικείμενο, χωρίς κείμενο έξω από αυτό, χωρίς markdown code fences, "
    "χωρίς εξήγηση. Η δομή πρέπει να είναι ακριβώς:\n"
    '{"detailed_result": "<λεπτομερής απάντηση στα ελληνικά>", '
    '"summary": "<μία πρόταση σύνοψης στα ελληνικά>", '
    '"sources": [{"url": "<url>", "title": "<τίτλος>"}], '
    '"limitations": ["<περιορισμός>"]}\n'
    "Κανόνες: (1) Μίλα μόνο ελληνικά. (2) Μπορείς να αναφέρεις ΜΟΝΟ πηγές που υπάρχουν στα δεδομένα "
    "της ερώτησης — ποτέ URLs που δεν σου δόθηκαν. (3) Αν τα δεδομένα είναι σχετικά ακόμη και αν δεν "
    "απαντούν πλήρως, δώσε ό,τι υποστηρίζουν, δήλωσε τους περιορισμούς και ΜΗ βάζεις "
    "\"insufficient data\". Χρησιμοποίησε \"insufficient data\" ΜΟΝΟ όταν κανένα δεδομένο δεν αφορά "
    "την ερώτηση ή δεν μπορεί να υποστηρίξει κανέναν ισχυρισμό. (4) Μην εφευρίσεις στοιχεία, αριθμούς, "
    "μελέτες ή πηγές. (5) Το summary πρέπει να περιλαμβάνει τους βασικούς αριθμούς μόνο αν υπάρχουν "
    "στα δεδομένα. (6) Στις limitations ανάφερε περιορισμούς όπως ελλιπή κάλυψη, παλαιότητα δεδομένων "
    "ή αβεβαιότητα πηγής."
)

USER_PROMPT_HEADER = "Ερώτηση χρήστη"
USER_PROMPT_CITY = "Πόλη"
USER_PROMPT_RECORDS = "Δεδομένα από τη βάση γνώσης (μόνο αυτές οι πηγές επιτρέπεται να αναφερθούν)"

DEFAULT_MAX_CHARS = 12000


def _record_line(index: int, record: dict) -> str:
    title = _clean_text(str(record.get("title") or record.get("name") or "χωρίς τίτλο"))
    url = str(record.get("source_url") or record.get("url") or "")
    description = _clean_text(str(record.get("description") or record.get("summary") or ""))
    if len(description) > 400:
        description = description[:400] + "…"
    source_name = str(record.get("source_name") or record.get("provider") or "")
    parts = [f"[{index}] {title}"]
    if source_name:
        parts.append(f"πηγή: {source_name}")
    if url:
        parts.append(f"url: {url}")
    if description:
        parts.append(f"περιγραφή: {description}")
    return " | ".join(parts)


def build_user_prompt(question: str, city: str, records: list[dict], *, max_chars: int = DEFAULT_MAX_CHARS) -> str:
    """User message: question + retrieved records, truncated to ~max_chars total."""
    header = (
        f"{USER_PROMPT_HEADER}: {question}\n"
        f"{USER_PROMPT_CITY}: {city or '—'}\n"
        f"{USER_PROMPT_RECORDS}:\n"
    )
    budget = max(500, int(max_chars) - len(header))
    lines: list[str] = []
    used = 0
    for index, record in enumerate(records or [], start=1):
        if not isinstance(record, dict):
            continue
        line = _record_line(index, record)
        if used + len(line) + 1 > budget:
            break
        lines.append(line)
        used += len(line) + 1
    if not lines:
        lines.append("(κανένα δεδομένο — απάντησε ότι τα δεδομένα είναι ανεπαρκή)")
    return header + "\n".join(lines)


def dumps_answer(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)
