"""Greek/English topic lexicon for relevance ranking (contract §4 retrieval).

Connector records are often in English (Eurostat) while questions arrive in Greek.
Topic ids bridge both languages so «πληθυσμός» matches "Population on 1 January".
"""
from __future__ import annotations

from typing import Any, Iterable

from services.ai_engine.rag import content_tokens, keyword_score, normalize_text, tokenize

# topic id -> prefixes (Greek stems + English stems). Matching is prefix-based on
# normalized tokens, so inflections (πληθυσμός/πληθυσμού, populations) are covered.
TOPICS: dict[str, tuple[str, ...]] = {
    "population": (
        "πληθυσμ", "δημογρ", "απογραφ", "κατοικ", "κατοικων",
        "population", "demograph", "census", "resident", "inhabit",
    ),
    "unemployment": ("ανεργ", "unemploy", "jobless"),
    "projects": (
        "εργ", "κατασκευ", "υλοποι", "αναπλασ", "project", "construction",
        "infrastructure",
    ),
    "decisions": ("αποφ", "διαυγει", "diavgeia", "decision", "δημοτικ"),
    "greenspace": ("πρασιν", "παρκ", "αλσ", "green", "park"),
    "traffic": (
        "κυκλοφορ", "δρομ", "μετακιν", "συγκοινων", "πεζοδρ", "ποδηλατ",
        "οδικ", "μετρο", "λεωφορ", "τραμ", "σιδηροδρομ", "σταθμ",
        "traffic", "road", "transport", "transit", "mobility",
    ),
    "weather": ("καιρ", "θερμοκρα", "βροχ", "weather", "temperature", "rain", "climate"),
    "health": ("υγει", "νοσοκομ", "health", "hospital"),
    "education": ("εκπαιδευ", "σχολ", "education", "school"),
    "budget": ("προυπολογ", "κοστο", "δαπαν", "budget", "cost", "spend"),
    "finance": (
        "οικονομ", "δημοσιονομ", "φορολογ", "εσοδ", "εξοδ", "χρε", "δανει",
        "ελλειμ", "πλεονασμ", "ταμει", "χρηματοδοτ", "κρατ", "προυπολογ",
        "δαπαν", "κοστο",
        "finance", "fiscal", "tax", "debt", "deficit", "surplus", "revenue",
        "expenditure", "treasury", "government", "sovereign", "public spending",
        "public finance",
    ),
    "prices": ("τιμ", "price", "inflation", "πληθωρισ"),
    "housing": ("στεγ", "ενοικ", "housing", "rent"),
    "airquality": ("ατμοσφαιρ", "ρυπαν", "air quality", "pollution", "pm10", "no2"),
}

# Generic buckets (decisions/projects) match almost any record of that kind, so
# they cannot be the only thing a specific question is filtered on.
SPECIFIC_TOPICS: frozenset[str] = frozenset(
    topic for topic in TOPICS if topic not in {"decisions", "projects"}
)

# keywords that hint the question wants official statistics
STATISTICS_HINTS = (
    "πληθυσμ", "δημογρ", "απογραφ", "ανεργ", "πληθωρισ", "στατιστ", "δεικτ",
    "ετος", "ετων", "δεκαετ", "εξελιξ", "μεταβολ", "αυξηθ", "μειωθ",
    "population", "demograph", "census", "unemploy", "inflation", "statistic",
    "trend", "growth", "decade",
)


def _is_prefix_match(token: str, prefix: str) -> bool:
    if not token or not prefix:
        return False
    if len(prefix) < 3:
        return token == prefix
    return token.startswith(prefix)


def topics_of_tokens(tokens: Iterable[str]) -> set[str]:
    found: set[str] = set()
    for token in tokens:
        for topic, prefixes in TOPICS.items():
            if any(_is_prefix_match(token, prefix) for prefix in prefixes):
                found.add(topic)
    return found


def topics_of_text(text: str) -> set[str]:
    return topics_of_tokens(tokenize(text))


def relevance(query: str, record: Any) -> float:
    """Keyword overlap + bilingual topic overlap. 0 when unrelated."""
    if not isinstance(record, dict):
        return 0.0
    base = keyword_score(query or "", " ".join(content_tokens(record)))
    query_topics = topics_of_text(query or "")
    if not query_topics:
        return base
    record_topics = topics_of_tokens(content_tokens(record))
    topic_score = len(query_topics & record_topics) / len(query_topics)
    title_topics = topics_of_text(str(record.get("title") or record.get("name") or ""))
    title_score = len(query_topics & title_topics) / len(query_topics)
    return base + 0.6 * topic_score + 0.4 * title_score


def mentions_statistics(question: str) -> bool:
    normalized = normalize_text(question or "")
    return any(hint in normalized for hint in STATISTICS_HINTS)


_STATE_HINTS = (
    "κρατ", "δημοσιονομ", "κυβερν", "υπουργει", "state", "government",
    "national", "sovereign", "public finance",
)
_MUNICIPAL_HINTS = ("δημου", "δημοτικ", "δημαρχ", "περιφερει", "municipal", "city")


def is_national_finance(question: str) -> bool:
    """True for questions about state/national finances rather than a city budget."""
    if "finance" not in topics_of_text(question or ""):
        return False
    normalized = normalize_text(question or "")
    if any(hint in normalized for hint in _MUNICIPAL_HINTS):
        return False
    return any(hint in normalized for hint in _STATE_HINTS)


def _is_municipal_record(record: dict) -> bool:
    text = normalize_text(
        " ".join(
            str(record.get(key) or "")
            for key in ("title", "description", "provider", "source_name")
        )
    )
    return any(hint in text for hint in _MUNICIPAL_HINTS)


TOPIC_LABELS: dict[str, str] = {
    "population": "πληθυσμός",
    "unemployment": "ανεργία",
    "projects": "έργα",
    "decisions": "αποφάσεις",
    "greenspace": "πράσινο",
    "traffic": "κυκλοφορία",
    "weather": "καιρός",
    "health": "υγεία",
    "education": "εκπαίδευση",
    "budget": "προϋπολογισμός",
    "finance": "δημόσια οικονομικά",
    "prices": "τιμές",
    "housing": "στέγαση",
    "airquality": "ατμοσφαιρική ρύπανση",
}

_CITY_LABELS: tuple[tuple[str, str], ...] = (
    ("αθηνα", "Αθήνα"),
    ("θεσσαλονικ", "Θεσσαλονίκη"),
    ("πατρα", "Πάτρα"),
    ("ηρακλει", "Ηράκλειο"),
)

_QUERY_NOISE = {
    "πως", "πωσ", "εχει", "εχουν", "αλλαξε", "αλλαγη", "τελευταια", "τελευταιεσ",
    "δεκαετια", "ετοσ", "ετων", "χρονια", "ποσα", "ποσεσ", "ποιοσ", "ποια", "ποιεσ",
    "ποιων", "ποιο", "γιατι", "γινεται", "γινονται", "δειχνει", "δειχνουν", "σημερα",
    "τωρα", "μου", "μασ", "σασ", "ειναι", "ηταν", "θελω", "ξερω", "πες", "δωσε",
    "σχετικα", "μεταβολη", "αυξηση", "μειωση", "στοιχεια", "δεδομενα",
    "επηρεαζει", "επηρεαζουν", "επιρρεαζει", "αμεσα", "please", "show",
    "tell", "about", "change", "changed", "last", "decade", "years", "how", "what",
}

# Overrides for web/knowledge search terms when topic labels alone are too vague.
_PHRASE_OVERRIDES: tuple[tuple[frozenset[str], str], ...] = (
    (frozenset({"finance", "decisions"}), "αποφάσεις κρατικός προϋπολογισμός"),
    (frozenset({"finance"}), "δημόσια οικονομικά κρατικός προϋπολογισμός"),
)


def search_terms(question: str) -> str:
    """Compact search query for web/knowledge APIs («πληθυσμός Αθήνα»)."""
    normalized = normalize_text(question or "")
    topics = topics_of_text(question or "")
    override = next((phrase for keys, phrase in _PHRASE_OVERRIDES if keys <= topics), None)
    if override:
        parts: list[str] = [override]
    else:
        parts = [TOPIC_LABELS[topic] for topic in TOPICS if topic in topics]
    for stem, label in _CITY_LABELS:
        if stem in normalized and label not in parts:
            parts.append(label)
    if not parts:
        tokens = [
            token
            for token in tokenize(question or "")
            if len(token) >= 4 and token not in _QUERY_NOISE
        ]
        parts = tokens[:4]
    return " ".join(dict.fromkeys(parts))[:120]


def relevant_records(
    question: str, records: list[dict], *, limit: int = 40, min_score: float = 0.12
) -> list[dict]:
    """Rank by relevance and drop noise when at least one record is relevant.

    Falls back to the original order when nothing scores (generic questions), so
    the LLM still receives context instead of an artificial empty state.
    """
    items = [r for r in (records or []) if isinstance(r, dict)]
    if not items:
        return []
    scored = [(relevance(question, record), index, record) for index, record in enumerate(items)]

    query_topics = topics_of_text(question or "")
    focus = query_topics & SPECIFIC_TOPICS
    if focus:
        # A specific question must not be answered with generic decision/project
        # buckets alone (e.g. data-disposal decisions for a finance question).
        chosen = [
            item
            for item in scored
            if topics_of_tokens(content_tokens(item[2])) & focus
        ]
    elif query_topics:
        chosen = [
            item
            for item in scored
            if topics_of_tokens(content_tokens(item[2])) & query_topics
        ]
    else:
        chosen = [item for item in scored if item[0] >= min_score] or scored

    if is_national_finance(question):
        national = [item for item in chosen if not _is_municipal_record(item[2])]
        if national:
            chosen = national

    chosen.sort(key=lambda item: (-item[0], item[1]))
    return [record for _, _, record in chosen[: max(0, int(limit))]]


def topic_count(question: str, records: list[dict], *, min_score: float = 0.2) -> int:
    query_topics = topics_of_text(question or "")
    focus = query_topics & SPECIFIC_TOPICS
    wanted = focus or query_topics
    if not wanted:
        return sum(1 for record in records if relevance(question, record) >= min_score)
    return sum(
        1
        for record in records
        if relevance(question, record) >= min_score
        and topics_of_tokens(content_tokens(record)) & wanted
    )
