"""Topic lexicon tests: Greek question ↔ English records, search terms."""
from __future__ import annotations

from services.ai_engine import lexicon


def test_population_question_matches_english_eurostat_record():
    record = {
        "title": "Population on 1 January by age and sex",
        "description": "Time frequency: Annual",
        "source_name": "eurostat",
    }
    score = lexicon.relevance("Πώς έχει αλλάξει ο πληθυσμός της Αθήνας;", record)
    assert score >= 0.6


def test_relevant_records_drops_unrelated_noise_for_topic_questions():
    question = "Πώς έχει αλλάξει ο πληθυσμός της Αθήνας την τελευταία δεκαετία;"
    records = [
        {"title": "Πληθυσμός Αττικής — Eurostat", "description": "χρονοσειρά πληθυσμού"},
        {"title": "Κρητικά Χρονικά", "description": "πολιτιστικό περιοδικό"},
        {"title": "Αρχείο παλαιών χαρτών της Αθήνας", "description": "χάρτες 1834-1950"},
    ]
    ranked = lexicon.relevant_records(question, records)
    assert [item["title"] for item in ranked] == ["Πληθυσμός Αττικής — Eurostat"]


def test_search_terms_compacts_natural_language():
    assert lexicon.search_terms(
        "Πώς έχει αλλάξει ο πληθυσμός της Αθήνας την τελευταία δεκαετία;"
    ) == "πληθυσμός Αθήνα"
    assert "ανεργία" in lexicon.search_terms("Ποια είναι η ανεργία στην Αθήνα;")


def test_finance_question_ignores_generic_data_disposal_decisions():
    question = "Ποια απόφαση επηρεάζει άμεσα τα οικονομικά του κράτους;"
    records = [
        {
            "title": "Απόφαση Διάθεσης Δεδομένων - ΔΕ Ραδιοφώνου Πολυγύρου",
            "description": "Απόφαση · data.gov.gr",
        },
        {
            "title": "Έγκριση δαπάνης μετακίνησης",
            "description": "Δαπάνη 500 ευρώ · Υπουργείο",
        },
        {
            "title": "Απόφαση κατάρτισης κρατικού προϋπολογισμού 2026",
            "description": "Δημοσιονομική απόφαση",
        },
        {
            "title": "Προϋπολογισμός Δήμου Φαρσάλων 2026",
            "description": "Τοπικός προϋπολογισμός",
        },
    ]
    ranked = lexicon.relevant_records(question, records)
    titles = [item["title"] for item in ranked]
    assert titles == [
        "Απόφαση κατάρτισης κρατικού προϋπολογισμού 2026",
        "Έγκριση δαπάνης μετακίνησης",
    ]
    assert lexicon.is_national_finance(question) is True
    assert lexicon.is_national_finance("Ποιος είναι ο προϋπολογισμός της Αθήνας;") is False
    assert lexicon.is_national_finance("Ποια είναι τα δημοσιονομικά του Δήμου Αθηναίων;") is False
    terms = lexicon.search_terms(question)
    assert "αποφάσεις" in terms and "προϋπολογισμός" in terms
