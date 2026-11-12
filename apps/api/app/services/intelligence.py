"""Ask the City intelligence service (contracts §2 AI module + §9.1 import map).

run_ai_query(question, city=None, request_id=None) → (AIAnswer, meta) and NEVER raises:
unexpected failures degrade to a Greek fallback answer (ok:true envelope); the only
ok:false envelopes come from the global 500 handler.
"""
from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from app.config import get_settings
from app.repositories import city as city_repo
from app.repositories import datasets as datasets_repo
from app.repositories import sources as sources_repo
from services.ai_engine import lexicon
from services.ai_engine.orchestrator import answer_question, answer_question_stream
from services.connector_kit.base import NormalizedRecord
from services.connector_kit.catalog import CONNECTOR_CLASSES
from services.geospatial_engine.queries import bbox_from_center

logger = logging.getLogger("policylab.intelligence")

NO_CONNECTORS_ALERT = "Δεν υπάρχουν ενεργοποιημένοι συνθέτες δεδομένων."
LLM_UNAVAILABLE_ALERT = "Η τεχνητή νοημοσύνη είναι προσωρινά μη διαθέσιμη."

# intent keywords (Greek + English) → connector names (contract §5.2)
INTENT_KEYWORDS: dict[str, list[str]] = {
    "openmeteo": ["καιρός", "weather", "θερμοκρασία", "temperature", "βροχή", "rain",
                  "forecast", "πρόγνωση", "wind", "άνεμος"],
    "diavgeia": ["αποφάσ", "decision", "διαύγεια", "diavgeia", "πρακτικό", "απόφαση",
                 "decisions", "υπουργ"],
    "kimdis": ["σύμβαση", "contract", "κημδησ", "kimdis", "προμήθεια", "tender", "διαγωνισμ"],
    "elstat": ["στατιστ", "statistics", "πληθυσμ", "population", "ανεργία", "unemployment",
               "ελστατ", "elstat", "δημογραφ"],
    "eurostat": ["eurostat", "ευρωπαϊκ", "european", "ενδείξεις", "indicators"],
    "overpass": ["traffic", "κυκλοφορ", "roads", "δρόμοι", "accessibility", "προσβασιμ",
                 "poi", "κτίρια", "buildings", "schools", "σχολεία", "χάρτης", "map",
                 "πάρκα", "parks", "πράσιν"],
    "ckan": ["dataset", "δεδομένα", "open data", "πηγή", "datasets", "ckan"],
    "athens": ["αθήνα", "athens", "δήμος", "municipality", "κατοικ", "neighborhood"],
    "data_europa": ["data.europa", "ευρωπαϊκός κατάλογος", "eu datasets"],
    "wikipedia": ["wikipedia", "wiki", "εγκυκλοπαίδεια"],
    "websearch": ["google", "αναζήτηση στο διαδίκτυο", "web search", "διαδίκτυο"],
}

SUGGESTED_ACTIONS = [
    "Εξερευνήστε τα layers της ψηφιακής δίδυμης πόλης",
    "Αναζήτηση στα ανοικτά δεδομένα",
    "Δείτε πρόσφατες δημόσιες αποφάσεις",
    "Δοκιμάστε προσομοίωση πολιτικής",
]


def select_connectors(question: str, enabled: dict[str, bool]) -> list[tuple[str, Any]]:
    """Intent keywords → enabled connector instances (contract §9.1: catalog only)."""
    lowered = (question or "").lower()
    wanted: list[str] = []
    for name, keywords in INTENT_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            wanted.append(name)

    names = wanted or [
        name for name in CONNECTOR_CLASSES if name not in {"wikipedia", "websearch"}
    ]
    selected: list[tuple[str, Any]] = []
    for name in names:
        if name not in CONNECTOR_CLASSES:
            continue
        if enabled and not enabled.get(name, True):
            continue
        try:
            from app.repositories.sources import make_connector

            instance = make_connector(name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("select_connectors: %s → %s", name, exc)
            instance = None
        if instance is not None:
            selected.append((name, instance))
    return selected


async def collect_records(
    question: str, selected: list[tuple[str, Any]]
) -> tuple[list[dict[str, Any]], list[str]]:
    """Gather NormalizedRecord dicts from every connector (gather, never raise)."""
    if not selected:
        return [], []
    tasks = [instance.search(query=question, limit=30) for _, instance in selected]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    records: list[dict[str, Any]] = []
    for (name, _instance), result in zip(selected, results):
        if isinstance(result, BaseException):
            logger.warning("connector %s απέτυχε: %s", name, result)
            continue
        for record in result or []:
            try:
                if isinstance(record, NormalizedRecord):
                    records.append(record.to_dict())
                elif isinstance(record, dict):
                    records.append(record)
            except Exception as exc:  # noqa: BLE001
                logger.warning("connector %s: μη έγκυρο record (%s)", name, exc)
    return records, [str(instance.source_url) for _, instance in selected if instance.source_url]


DECISION_HINTS = ["αποφ", "decision", "διαύγεια", "diavgeia", "δημοτικ"]
PROJECT_HINTS = ["έργ", "εργ", "project", "κατασκευ", "ανάπλασ", "προϋπολογ", "budget", "υλοποι"]


def _wants(question: str, hints: list[str]) -> bool:
    lowered = (question or "").lower()
    return any(hint in lowered for hint in hints)


async def govtech_records(question: str) -> list[dict[str, Any]]:
    """Decisions/projects from the DB as RAG records (demo fallback for live feeds)."""
    records: list[dict[str, Any]] = []
    try:
        from app.repositories import decisions as decisions_repo

        if _wants(question, DECISION_HINTS):
            items, _, _, _ = await decisions_repo.list_from_db(page=1, page_size=20)
            for item in items:
                records.append(
                    {
                        "title": item.get("title") or "",
                        "provider": item.get("org") or "Διαύγεια",
                        "source_name": item.get("org") or "Διαύγεια",
                        "category": item.get("decision_type"),
                        "published_at": item.get("date"),
                        "source_url": item.get("url") or "",
                        "description": (
                            f"{item.get('decision_type') or 'Απόφαση'} · "
                            f"{item.get('org') or ''} · {item.get('date') or ''}"
                        ),
                        "extra": {"id": item.get("id"), "project_id": item.get("project_id")},
                    }
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning("govtech decisions records: %s", exc)

    try:
        from app.repositories import projects as projects_repo

        if _wants(question, PROJECT_HINTS):
            items, _, _, _ = await projects_repo.list_from_db()
            for item in items:
                budget = item.get("budget")
                records.append(
                    {
                        "title": item.get("name") or "",
                        "provider": item.get("org") or "Δήμος",
                        "source_name": item.get("org") or "Δήμος",
                        "category": item.get("status"),
                        "source_url": item.get("url") or "",
                        "description": (
                            f"Κατάσταση: {item.get('status') or '—'} · "
                            f"Προϋπολογισμός: {budget if budget is not None else '—'} € · "
                            f"Συνδεδεμένες αποφάσεις: {len(item.get('decisions') or [])}"
                        ),
                        "extra": {
                            "id": item.get("id"),
                            "status": item.get("status"),
                            "budget": budget,
                        },
                    }
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning("govtech projects records: %s", exc)

    return records


RAG_RECORD_LIMIT = 40


def _gr_number(value: float) -> str:
    return f"{int(round(float(value))):,}".replace(",", ".")


def _gr_percent(value: float) -> str:
    return f"{value:+.1f}".replace(".", ",") + "%"


def _series_points(series: list[tuple[str, float]]) -> list[tuple[int, float]]:
    points: list[tuple[int, float]] = []
    for label, value in series or []:
        try:
            points.append((int(str(label)[:4]), float(value)))
        except (TypeError, ValueError):
            continue
    points.sort(key=lambda item: item[0])
    return points


def _nearest_point(
    points: list[tuple[int, float]], target_year: int
) -> tuple[int, float] | None:
    if not points:
        return None
    earlier = [point for point in points if point[0] <= target_year]
    if earlier:
        return earlier[-1]
    return points[0]


def _series_tail(points: list[tuple[int, float]], count: int = 5) -> str:
    tail = points[-count:]
    return ", ".join(f"{year}: {_gr_number(value)}" for year, value in tail)


def _population_record(series: dict[str, Any]) -> dict[str, Any] | None:
    points = _series_points(series.get("series") or [])
    if len(points) < 2:
        return None
    latest_year, latest_value = points[-1]
    decade = _nearest_point(points, latest_year - 10)
    first_year = points[0][0]
    change = ""
    if decade and decade[1]:
        pct = (latest_value - decade[1]) / decade[1] * 100.0
        change = (
            f"Μεταβολή {decade[0]}–{latest_year}: {_gr_percent(pct)} "
            f"({_gr_number(latest_value - decade[1])} κάτοικοι). "
        )
    description = (
        "Επίσημη χρονοσειρά Eurostat για τον πληθυσμό της Αττικής "
        "(NUTS 2, EL30 — περιλαμβάνει την Αθήνα). "
        f"Τελευταίο έτος {latest_year}: {_gr_number(latest_value)} κάτοικοι. "
        f"Το {decade[0] if decade else first_year}: "
        f"{_gr_number(decade[1]) if decade else '—'} κάτοικοι. "
        f"{change}Πρόσφατα έτη — {_series_tail(points)}."
    )
    return {
        "title": f"Πληθυσμός Αττικής — Eurostat {first_year}–{latest_year}",
        "description": description[:1000],
        "provider": "Eurostat",
        "source_name": "eurostat",
        "source_url": (
            "https://ec.europa.eu/eurostat/databrowser/view/demo_r_pjanaggr3/default/table"
        ),
        "category": "statistics",
        "tags": ["eurostat", "πληθυσμός", "απογραφή", "Αττική", "EL30"],
        "extra": {"dataset_code": series.get("dataset"), "geo": "EL30"},
    }


def _unemployment_record(series: dict[str, Any]) -> dict[str, Any] | None:
    points = _series_points(series.get("series") or [])
    if len(points) < 2:
        return None
    latest_year, latest_value = points[-1]
    decade = _nearest_point(points, latest_year - 10)
    first_year = points[0][0]
    change = ""
    if decade:
        change = (
            f"Μεταβολή {decade[0]}–{latest_year}: "
            f"{_gr_percent(latest_value - decade[1])} μονάδες. "
        )
    tail = ", ".join(
        f"{year}: {str(value).replace('.', ',')}%" for year, value in points[-5:]
    )
    latest_text = str(latest_value).replace(".", ",")
    decade_text = str(decade[1]).replace(".", ",") if decade else "—"
    description = (
        "Επίσημο ποσοστό ανεργίας Eurostat για την Αττική (NUTS 2, EL30). "
        f"Τελευταίο έτος {latest_year}: {latest_text}%. "
        f"Το {decade[0] if decade else first_year}: {decade_text}%. "
        f"{change}Σειρά: {tail}."
    )
    return {
        "title": f"Ανεργία Αττικής — Eurostat {first_year}–{latest_year}",
        "description": description[:1000],
        "provider": "Eurostat",
        "source_name": "eurostat",
        "source_url": "https://ec.europa.eu/eurostat/databrowser/view/lfst_r_lfu3rt/default/table",
        "category": "statistics",
        "tags": ["eurostat", "ανεργία", "απασχόληση", "Αττική", "EL30"],
        "extra": {"dataset_code": series.get("dataset"), "geo": "EL30"},
    }


def _finance_record(finance: dict[str, Any]) -> dict[str, Any] | None:
    series: dict[str, list[tuple[int, float]]] = {}
    for key in ("deficit", "debt", "revenue", "expenditure"):
        value = finance.get(key)
        points = _series_points(value.get("series") or []) if isinstance(value, dict) else []
        if points:
            series[key] = points
    if not series:
        return None

    common_years = [points[-1][0] for points in series.values()]
    latest_year = min(common_years)
    values = {key: dict(points).get(latest_year) for key, points in series.items()}
    first_year = min(points[0][0] for points in series.values())

    parts: list[str] = [
        "Επίσημα ετήσια δημοσιονομικά μεγέθη Eurostat για την Ελλάδα "
        "(γενική κυβέρνηση, S13). Δεν πρόκειται για απόφαση· είναι στατιστικά στοιχεία"
    ]
    deficit = values.get("deficit")
    if deficit is not None:
        label = "πλεόνασμα" if deficit >= 0 else "έλλειμμα"
        parts.append(f"Ισοζύγιο {latest_year}: {label} {abs(deficit):.1f}% ΑΕΠ".replace(".", ","))
    debt = values.get("debt")
    if debt is not None:
        parts.append(f"Δημόσιο χρέος {debt:.1f}% ΑΕΠ".replace(".", ","))
    revenue = values.get("revenue")
    expenditure = values.get("expenditure")
    if revenue is not None and expenditure is not None:
        balance = revenue - expenditure
        label = "πλεόνασμα" if balance >= 0 else "έλλειμμα"
        parts.append(
            f"Έσοδα {_gr_number(revenue)} εκατ. €, δαπάνες {_gr_number(expenditure)} εκατ. € "
            f"({label} {_gr_number(abs(balance))} εκατ. €)"
        )
    deficit_points = series.get("deficit") or []
    if deficit_points:
        tail = ", ".join(
            f"{year}: {str(value).replace('.', ',')}%" for year, value in deficit_points[-5:]
        )
        parts.append(f"Πρόσφατο ισοζύγιο — {tail}")

    return {
        "title": f"Δημόσια οικονομικά Ελλάδας — Eurostat {first_year}–{latest_year}",
        "description": ". ".join(parts)[:1000],
        "provider": "Eurostat",
        "source_name": "eurostat",
        "source_url": (
            "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table"
        ),
        "category": "statistics",
        "tags": [
            "eurostat", "δημόσια οικονομικά", "προϋπολογισμός", "έλλειμμα",
            "χρέος", "δαπάνες", "έσοδα", "Ελλάδα",
        ],
        "extra": {"dataset_code": "gov_10a_main", "geo": "EL"},
    }


def _point_in_polygon(x: float, y: float, points: list[tuple[float, float]]) -> bool:
    inside = False
    count = len(points)
    for index in range(count):
        x1, y1 = points[index]
        x2, y2 = points[(index + 1) % count]
        if (y1 > y) != (y2 > y):
            x_cross = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < x_cross:
                inside = not inside
    return inside


def _polygon_circle_overlap_m2(
    ring: list[list[float]], lat0: float, lon0: float, radius_m: float
) -> float:
    """Rough polygon∩circle area by sampling a 15 m grid in local metres."""
    if len(ring) < 4:
        return 0.0
    cos_lat = max(math.cos(math.radians(lat0)), 1e-6)
    points = [
        ((float(lon) - lon0) * 111_320.0 * cos_lat, (float(lat) - lat0) * 111_320.0)
        for lon, lat in ((pt[0], pt[1]) for pt in ring)
    ]
    if points and points[0] == points[-1]:
        points = points[:-1]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    step = 15.0
    minx, maxx = max(min(xs), -radius_m), min(max(xs), radius_m)
    miny, maxy = max(min(ys), -radius_m), min(max(ys), radius_m)
    if maxx <= minx or maxy <= miny:
        return 0.0
    nx = max(1, int(math.ceil((maxx - minx) / step)))
    ny = max(1, int(math.ceil((maxy - miny) / step)))
    if nx * ny > 40_000:
        step = math.sqrt((maxx - minx) * (maxy - miny) / 40_000)
        nx = max(1, int(math.ceil((maxx - minx) / step)))
        ny = max(1, int(math.ceil((maxy - miny) / step)))
    hits = 0
    for ix in range(nx):
        x = minx + (ix + 0.5) * step
        for iy in range(ny):
            y = miny + (iy + 0.5) * step
            if x * x + y * y <= radius_m * radius_m and _point_in_polygon(x, y, points):
                hits += 1
    return hits * step * step


def _greenspace_records(
    features: list[dict], areas: list[dict], population: list[dict]
) -> list[dict[str, Any]]:
    polygons: list[tuple[list[list[float]], str]] = []
    for feature in features:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Polygon":
            continue
        coordinates = geometry.get("coordinates") or []
        if not coordinates or not isinstance(coordinates[0], list):
            continue
        name = str((feature.get("properties") or {}).get("name") or "χώρος πρασίνου")
        polygons.append((coordinates[0], name))
    if not polygons:
        return []

    population_by_name = {
        str((feature.get("properties") or {}).get("name") or "").lower(): (
            feature.get("properties") or {}
        ).get("population")
        for feature in population
    }
    population_points: list[tuple[float, float, Any]] = []
    for feature in population:
        coordinates = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coordinates) >= 2:
            try:
                population_points.append(
                    (
                        float(coordinates[0]),
                        float(coordinates[1]),
                        (feature.get("properties") or {}).get("population"),
                    )
                )
            except (TypeError, ValueError):
                continue

    rows: list[dict[str, Any]] = []
    for area in areas:
        try:
            lat0 = float(area.get("lat"))
            lon0 = float(area.get("lon"))
            radius = float(area.get("radius_m") or 700)
        except (TypeError, ValueError):
            continue
        total = 0.0
        names: list[str] = []
        for ring, name in polygons:
            overlap = _polygon_circle_overlap_m2(ring, lat0, lon0, radius)
            if overlap >= 250.0:
                total += overlap
                names.append(name)
        population_value = population_by_name.get(str(area.get("id") or "").lower())
        if population_value is None:
            population_value = population_by_name.get(
                str(area.get("name_el") or "").lower()
            )
        if population_value is None and population_points:
            nearest = min(
                population_points,
                key=lambda point: (point[0] - lon0) ** 2 + (point[1] - lat0) ** 2,
            )
            if (nearest[0] - lon0) ** 2 + (nearest[1] - lat0) ** 2 < 0.002**2:
                population_value = nearest[2]
        rows.append(
            {
                "area": str(area.get("name_el") or area.get("id") or ""),
                "radius": int(radius),
                "green_m2": int(round(total)),
                "count": len(names),
                "names": names,
                "population": int(population_value) if population_value else None,
            }
        )

    if not rows:
        return []
    rows.sort(key=lambda row: (row["green_m2"], row["area"]))
    total_count = len(rows)
    records: list[dict[str, Any]] = []
    for rank, row in enumerate(rows, start=1):
        per_1000 = (
            f"{row['green_m2'] / row['population'] * 1000:.1f}".replace(".", ",")
            if row.get("population")
            else "—"
        )
        names = ", ".join(row["names"]) if row["names"] else "κανένας καταγεγραμμένος χώρος"
        description = (
            f"Περιοχή {row['area']} (ακτίνα {row['radius']} μ.): "
            f"{_gr_number(row['green_m2'])} m² πρασίνου από {row['count']} χώρους "
            f"({names}). Πληθυσμός: {_gr_number(row['population']) if row['population'] else '—'}. "
            f"Πράσινο ανά 1.000 κατοίκους: {per_1000} m². "
            f"Κατάταξη συνολικού πρασίνου: {rank} από {total_count} "
            f"(1 = λιγότερο πράσινο)."
        )
        records.append(
            {
                "title": f"Πράσινο στην περιοχή {row['area']} — {_gr_number(row['green_m2'])} m²",
                "description": description[:1000],
                "provider": "Ψηφιακή Δίδυμη Πόλη (OSM/demo)",
                "source_name": "Ψηφιακή Δίδυμη Πόλη (OpenStreetMap)",
                "source_url": "https://www.openstreetmap.org",
                "category": "geospatial",
                "tags": [
                    "πράσινο", "γειτονιά", "Αθήνα", row["area"].lower(),
                    "openstreetmap", "digital twin",
                ],
                "extra": {
                    "area": row["area"],
                    "green_m2": row["green_m2"],
                    "green_per_1000": per_1000,
                    "rank_least_green": rank,
                },
            }
        )
    return records


async def city_records(question: str) -> list[dict[str, Any]]:
    """Computed neighbourhood green-space comparison from the Digital Twin layers."""
    if "greenspace" not in lexicon.topics_of_text(question):
        return []
    try:
        features_result, _ = await city_repo.query_features("green_spaces", None, 500)
        population_result, _ = await city_repo.query_features("population", None, 100)
        areas, _ = await city_repo.list_areas()
    except Exception as exc:  # noqa: BLE001
        logger.warning("city green records: %s", exc)
        return []
    return _greenspace_records(
        list((features_result or {}).get("features") or []),
        list(areas or []),
        list((population_result or {}).get("features") or []),
    )


async def statistics_records(question: str) -> list[dict[str, Any]]:
    """Live Eurostat series with real values for Attica/Greece."""
    topics = lexicon.topics_of_text(question)
    records: list[dict[str, Any]] = []
    if not topics.intersection({"population", "unemployment", "finance"}):
        return records

    from services.open_data_connectors import eurostat as eurostat_connector

    if "population" in topics:
        try:
            series = await asyncio.wait_for(
                eurostat_connector.fetch_population_series(), timeout=25.0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("eurostat population series: %s", exc)
            series = None
        if series:
            record = _population_record(series)
            if record:
                records.append(record)

    if "unemployment" in topics:
        try:
            series = await asyncio.wait_for(
                eurostat_connector.fetch_unemployment_series(), timeout=25.0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("eurostat unemployment series: %s", exc)
            series = None
        if series:
            record = _unemployment_record(series)
            if record:
                records.append(record)

    if "finance" in topics:
        try:
            finance = await asyncio.wait_for(
                eurostat_connector.fetch_finance_series(), timeout=30.0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("eurostat finance series: %s", exc)
            finance = None
        if finance:
            record = _finance_record(finance)
            if record:
                records.append(record)

    return records


async def web_records(question: str, *, limit: int = 3) -> list[dict[str, Any]]:
    """Web fallback when curated sources are too thin: DuckDuckGo, then Wikipedia."""
    try:
        from app.repositories.sources import make_connector
    except Exception as exc:  # noqa: BLE001
        logger.warning("web fallback: %s", exc)
        return []

    terms = lexicon.search_terms(question) or question
    for name in ("websearch", "wikipedia"):
        try:
            connector = make_connector(name)
            if connector is None:
                continue
            found = await connector.search(query=terms, limit=limit)
        except Exception as exc:  # noqa: BLE001
            logger.warning("web fallback %s: %s", name, exc)
            continue
        records: list[dict[str, Any]] = []
        for record in found or []:
            if isinstance(record, NormalizedRecord):
                records.append(record.to_dict())
            elif isinstance(record, dict):
                records.append(record)
        if records:
            return records
    return []


def filter_by_bbox(records: list[dict[str, Any]], bbox: list[float]) -> list[dict[str, Any]]:
    """Keep records without coordinates; drop geo records outside [w,s,e,n]."""
    w, s, e, n = bbox
    kept: list[dict[str, Any]] = []
    for record in records:
        lat, lon = record.get("lat"), record.get("lon")
        if lat is None or lon is None:
            kept.append(record)
            continue
        try:
            lat_f, lon_f = float(lat), float(lon)
        except (TypeError, ValueError):
            kept.append(record)
            continue
        if w <= lon_f <= e and s <= lat_f <= n:
            kept.append(record)
    return kept


def _fallback_answer() -> dict[str, Any]:
    return {
        "detailed_result": (
            "Παρουσιάστηκε μη αναμενόμενο σφάλμα κατά την ανάκτηση δεδομένων. "
            "Δοκιμάστε ξανά σε λίγο με διαφορετική διατύπωση."
        ),
        "summary": "Προσωρινή αδυναμία ανάκτησης απάντησης.",
        "sources": [],
        "limitations": ["internal error"],
    }


def build_meta(
    request_id: str | None,
    sources: list[str],
    record_count: int,
    limitations: list[str],
    show_map: bool,
    alert: str | None,
) -> dict[str, Any]:
    """meta exactly per contracts §2 (AI module)."""
    from app.envelope import build_meta as _build_meta

    return _build_meta(
        request_id,
        sources=sources,
        record_count=record_count,
        limitations=limitations,
        ui={
            "show_map": bool(show_map),
            "empty_state": record_count == 0,
            "suggested_actions": list(SUGGESTED_ACTIONS),
            "alert": alert,
        },
    )


async def _gather_context(
    question: str, city_name: str
) -> tuple[list[tuple[str, Any]], list[dict[str, Any]], list[str], list[str]]:
    """Intent → connectors → DB govtech → bbox filter → truncate."""
    settings = get_settings()
    enabled = await sources_repo.enabled_connectors()
    selected = select_connectors(question, enabled)
    records, source_urls = await collect_records(question, selected)
    records.extend(await govtech_records(question))
    try:
        records.extend(await datasets_repo.search_relevant_datasets(question, limit=6))
    except Exception as exc:  # noqa: BLE001
        logger.warning("dataset records: %s", exc)
    records.extend(await city_records(question))

    stats = await statistics_records(question)
    if stats:
        records.extend(stats)
        if "https://ec.europa.eu/eurostat/databrowser/" not in source_urls:
            source_urls.append("https://ec.europa.eu/eurostat/databrowser/")

    lat0, lon0 = await city_repo.get_city_center(city_name)
    bbox = bbox_from_center(lat0, lon0, 5000.0)
    records = filter_by_bbox(records, bbox)
    records = lexicon.relevant_records(question, records, limit=RAG_RECORD_LIMIT)

    if lexicon.topic_count(question, records) < 3 or lexicon.is_national_finance(question):
        web = lexicon.relevant_records(question, await web_records(question), limit=4)
        if web:
            records = lexicon.relevant_records(question, records + web, limit=RAG_RECORD_LIMIT)
            if "https://el.wikipedia.org" not in source_urls:
                source_urls.append("https://el.wikipedia.org")

    extra_limitations: list[str] = []
    max_records = int(settings.max_ai_records or 200)
    if len(records) > max_records:
        records = records[:max_records]
        extra_limitations.append(f"truncated to {max_records}")
    return selected, records, source_urls, extra_limitations


def _finalize_meta(
    request_id: str | None,
    selected: list[tuple[str, Any]],
    records: list[dict[str, Any]],
    source_urls: list[str],
    extra_limitations: list[str],
    answer_limitations: list[str],
) -> dict[str, Any]:
    limitations: list[str] = []
    for item in list(answer_limitations or []) + list(extra_limitations or []):
        if isinstance(item, str) and item.strip() and item not in limitations:
            limitations.append(item)

    alert: str | None = None
    if not selected:
        alert = NO_CONNECTORS_ALERT
        if alert not in limitations:
            limitations.append(alert)
    elif "llm unavailable" in limitations:
        alert = LLM_UNAVAILABLE_ALERT

    show_map = any(
        isinstance(record.get("geometry"), dict)
        or (record.get("lat") is not None and record.get("lon") is not None)
        for record in records
    )

    return build_meta(
        request_id,
        sources=source_urls,
        record_count=len(records),
        limitations=limitations,
        show_map=show_map,
        alert=alert,
    )


async def run_ai_query(
    question: str, city: str | None = None, request_id: str | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Full AI pipeline: intent → connectors → bbox filter → truncate → LLM answer → meta."""
    settings = get_settings()
    city_name = str(city or settings.default_city or "Athens")
    selected: list[tuple[str, Any]] = []
    source_urls: list[str] = []
    records: list[dict[str, Any]] = []
    extra_limitations: list[str] = []

    try:
        selected, records, source_urls, extra_limitations = await _gather_context(
            question, city_name
        )
        answer = await answer_question(question, records=records, city=city_name)
        if not isinstance(answer, dict):
            answer = _fallback_answer()
    except Exception:  # noqa: BLE001 — run_ai_query NEVER raises
        logger.exception("run_ai_query: μη αναμενόμενο σφάλμα")
        answer = _fallback_answer()
        records = records or []
        source_urls = source_urls or []

    meta = _finalize_meta(
        request_id,
        selected,
        records,
        source_urls,
        extra_limitations,
        list(answer.get("limitations") or []),
    )
    return answer, meta


async def stream_ai_query(
    question: str, city: str | None = None, request_id: str | None = None
):
    """SSE-friendly generator: meta → token* → done {answer, meta}. Never raises."""
    settings = get_settings()
    city_name = str(city or settings.default_city or "Athens")
    selected: list[tuple[str, Any]] = []
    source_urls: list[str] = []
    records: list[dict[str, Any]] = []
    extra_limitations: list[str] = []

    try:
        selected, records, source_urls, extra_limitations = await _gather_context(
            question, city_name
        )
    except Exception:  # noqa: BLE001
        logger.exception("stream_ai_query: μη αναμενόμενο σφάλμα κατά τη συλλογή")

    yield {
        "type": "meta",
        "meta": _finalize_meta(
            request_id, selected, records, source_urls, extra_limitations, []
        ),
    }

    async for event in answer_question_stream(question, records=records, city=city_name):
        if event.get("type") != "answer":
            yield event
            continue
        answer = event.get("answer") or _fallback_answer()
        meta = _finalize_meta(
            request_id,
            selected,
            records,
            source_urls,
            extra_limitations,
            list(answer.get("limitations") or []),
        )
        yield {"type": "done", "answer": answer, "meta": meta}
