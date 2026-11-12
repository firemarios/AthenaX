"""Connector tests (contract §5.2): normalize, malformed tolerance, catalog, search never raises.

All HTTP via httpx.MockTransport — no real network.
"""
from __future__ import annotations

import asyncio

import httpx
import yaml

from services.connector_kit.base import BaseConnector, NormalizedRecord
from services.connector_kit.catalog import CONNECTOR_CLASSES
from services.govtech_connectors.athens import AthensConnector
from services.govtech_connectors.diavgeia import DiavgeiaConnector
from services.open_data_connectors.ckan import CkanConnector
from services.open_data_connectors.data_europa import DataEuropaConnector
from services.open_data_connectors.eurostat import EurostatConnector
from services.open_data_connectors.openmeteo import OpenMeteoConnector
from services.open_data_connectors.overpass import OverpassConnector

EXPECTED_KEYS = {
    "ckan",
    "diavgeia",
    "athens",
    "kimdis",
    "elstat",
    "eurostat",
    "overpass",
    "openmeteo",
    "data_europa",
    "wikipedia",
    "websearch",
}

CKAN_PAYLOAD = {
    "success": True,
    "result": {
        "count": 2,
        "results": [
            {
                "id": "abc",
                "name": "demo-dataset",
                "title": "Δημογραφικά δεδομένα",
                "notes": "Περιγραφή συνόλου",
                "license_title": "CC BY 4.0",
                "metadata_created": "2024-01-15T10:00:00.000Z",
                "metadata_modified": "2026-01-02T08:30:00.000Z",
                "organization": {"title": "ΕΛΣΤΑΤ", "name": "elstat"},
                "tags": [{"name": "δημογραφία"}, {"name": "statistics"}],
            },
            {"name": "second", "title": "Δεύτερο σύνολο"},
        ],
    },
}


def test_catalog_has_all_nine_keys():
    assert set(CONNECTOR_CLASSES) == EXPECTED_KEYS
    for key, cls in CONNECTOR_CLASSES.items():
        assert isinstance(cls, type), key
        assert issubclass(cls, BaseConnector), key


def test_catalog_matches_source_registry_yaml():
    with open("data/source-registry/catalog.yaml", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    names = {source["name"] for source in data["sources"]}
    assert names == set(CONNECTOR_CLASSES)


def test_ckan_normalize_happy_path():
    connector = CkanConnector()
    records = asyncio.run(connector.normalize(CKAN_PAYLOAD))
    assert len(records) == 2
    first = records[0]
    assert isinstance(first, NormalizedRecord)
    assert first.title == "Δημογραφικά δεδομένα"
    assert first.source_url == "https://data.gov.gr/datasets/demo-dataset"
    assert first.license == "CC BY 4.0"
    assert first.provider == "ΕΛΣΤΑΤ"
    assert "δημογραφία" in first.tags
    assert first.published_at is not None
    assert first.updated_at is not None
    assert first.reliability > 0


def test_ckan_normalize_tolerates_malformed_rows():
    connector = CkanConnector()
    payload = {
        "result": {
            "results": [
                None,
                42,
                {},
                {"title": ""},
                {"title": "Καλή εγγραφή", "tags": "όχι λίστα"},
                "χωρίς λεξικό",
                {"notes": "χωρίς τίτλο"},
            ]
        }
    }
    records = asyncio.run(connector.normalize(payload))
    assert len(records) == 1
    assert records[0].title == "Καλή εγγραφή"
    # Non-dict payloads also tolerated
    assert asyncio.run(connector.normalize("λάθος")) == []
    assert asyncio.run(connector.normalize(["λάθος"])) == []


def test_search_returns_empty_on_fetch_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no network", request=request)

    connector = CkanConnector(config={"transport": httpx.MockTransport(handler)})
    result = asyncio.run(connector.search("δοκιμή", limit=5))
    assert result == []


def test_diavgeia_returns_decision_like_records():
    payload = [
        {
            "ada": "ΑΔΑ:123",
            "title": "Άδεια διεξαγωγής εκδηλώσεων",
            "org": "Δήμος Αθηναίων",
            "date": "2025-06-01",
            "decisionTypeName": "Πρωτόκολλο",
        },
        {"ada": "ΑΔΑ:456"},
        None,
    ]
    connector = DiavgeiaConnector()
    records = asyncio.run(connector.normalize(payload))
    assert len(records) == 1
    record = records[0]
    assert record.title == "Άδεια διεξαγωγής εκδηλώσεων"
    assert record.provider == "Δήμος Αθηναίων"
    assert record.extra["ada"] == "ΑΔΑ:123"
    assert record.extra["date"] == "2025-06-01"
    assert record.extra["org"] == "Δήμος Αθηναίων"
    assert record.extra["decision_type"] == "Πρωτόκολλο"
    assert record.published_at is not None
    assert record.source_url.endswith("ΑΔΑ:123") or "diavgeia" in record.source_url


def test_athens_subclasses_ckan_with_default_q():
    assert issubclass(AthensConnector, CkanConnector)
    connector = AthensConnector()
    assert connector.config.get("q") == "Αθήνα"
    assert connector.name == "athens"


def test_overpass_normalize_points_and_query_build():
    connector = OverpassConnector()
    ql = connector.build_query("πάρκο", 10)
    assert "[out:json]" in ql
    assert "πάρκο" in ql
    assert "out center 10;" in ql

    payload = {
        "elements": [
            {"type": "node", "id": 1, "lat": 37.99, "lon": 23.73, "tags": {"name": "Πάρκο Κεραμεικού", "leisure": "park"}},
            {"type": "way", "id": 2, "center": {"lat": 37.98, "lon": 23.72}, "tags": {"name": "Σχολείο", "amenity": "school"}},
            {"type": "node", "id": 3, "tags": {"amenity": "bench"}},  # no name → skipped
            "garbage",
        ]
    }
    records = asyncio.run(connector.normalize(payload))
    assert len(records) == 2
    assert records[0].lat == 37.99
    assert records[0].source_url == "https://www.openstreetmap.org/node/1"
    assert records[1].category == "school"
    assert records[1].lat == 37.98


def test_openmeteo_normalize_current_weather():
    payload = {
        "latitude": 37.98,
        "longitude": 23.73,
        "timezone": "Europe/Athens",
        "current": {"time": "2026-11-10T12:00", "temperature_2m": 18.5, "precipitation": 0.2, "wind_speed_10m": 12.0, "weather_code": 3},
    }
    connector = OpenMeteoConnector()
    records = asyncio.run(connector.normalize(payload))
    assert len(records) == 1
    assert "18.5" in (records[0].description or "")
    assert records[0].extra["temperature_2m"] == 18.5
    # malformed payloads → []
    assert asyncio.run(connector.normalize({"foo": 1})) == []
    assert asyncio.run(connector.normalize(None)) == []


def test_data_europa_and_eurostat_normalize():
    eu = DataEuropaConnector()
    payload = {
        "result": {
            "items": [
                {"id": "http://data.europa.eu/xyz", "title": {"en": "EU dataset"}, "description": {"en": "desc"}},
                {"title": "Χωρίς URL"},
                None,
            ]
        }
    }
    records = asyncio.run(eu.normalize(payload))
    assert len(records) == 2
    assert records[0].source_url == "http://data.europa.eu/xyz"

    euro = EurostatConnector()
    stat_payload = {
        "_dataset": "demo_pjan",
        "label": "Population on 1 January",
        "id": ["geo", "time"],
        "dimension": {
            "geo": {"label": "Geographic unit", "category": {"index": {"EL": 0}, "label": {"EL": "Greece"}}},
            "time": {"label": "Time", "category": {"index": {"2024": 0}, "label": {"2024": "2024"}}},
        },
        "value": {"0": 1000},
    }
    stats = asyncio.run(euro.normalize(stat_payload))
    assert len(stats) == 1
    assert stats[0].title == "Population on 1 January"
    assert "demo_pjan" in stats[0].source_url
    assert "Greece" in (stats[0].description or "")


def test_eurostat_jsonstat_time_series():
    from services.open_data_connectors.eurostat import _jsonstat_series

    payload = {
        "id": ["sex", "age", "geo", "time"],
        "size": [2, 1, 1, 3],
        "dimension": {
            "sex": {"category": {"index": {"T": 0, "M": 1}}},
            "age": {"category": {"index": {"TOTAL": 0}}},
            "geo": {"category": {"index": {"EL30": 0}}},
            "time": {"category": {"index": {"2022": 0, "2023": 1, "2024": 2}}},
        },
        "value": {"0": 100, "1": 120, "2": 130, "3": 49, "4": 60, "5": 65},
    }
    series = _jsonstat_series(payload, {"sex": "T", "age": "TOTAL", "geo": "EL30"})
    assert series == [("2022", 100.0), ("2023", 120.0), ("2024", 130.0)]
    assert _jsonstat_series(payload, {"sex": "F", "age": "TOTAL", "geo": "EL30"}) == []


def test_websearch_and_wikipedia_normalize():
    from services.open_data_connectors.websearch import WebSearchConnector
    from services.open_data_connectors.wikipedia import WikipediaConnector

    html = (
        '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fa">'
        "Απογραφή 2021</a>"
        '<a class="result__snippet" href="#">Πληθυσμός Αττικής 3.792.469</a>'
        '<a rel="nofollow" class="result__a" href="https://example.org/b">Δεύτερη πηγή</a>'
    )
    web = asyncio.run(WebSearchConnector().normalize(html))
    assert len(web) == 2
    assert web[0].source_url == "https://example.org/a"
    assert "3.792.469" in (web[0].description or "")

    wiki_raw = {
        "query": {
            "search": [
                {"title": "Αθήνα", "snippet": '<span class="searchmatch">πληθυσμός</span> Αθήνας'},
                {"title": "", "snippet": "ignored"},
            ]
        }
    }
    wiki = asyncio.run(
        WikipediaConnector(
            config={
                "transport": httpx.MockTransport(
                    lambda request: httpx.Response(200, json={"query": {"pages": {}}})
                )
            }
        ).normalize(wiki_raw)
    )
    assert len(wiki) == 1
    assert "πληθυσμός" in (wiki[0].description or "")
    assert wiki[0].source_url.startswith("https://el.wikipedia.org/wiki/")

