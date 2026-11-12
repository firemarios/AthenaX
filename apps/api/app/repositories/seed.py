"""Startup seeding: data/source-registry/*.yaml → DB (upsert by name, non-fatal)."""
from __future__ import annotations

import logging

from app.repositories.common import repo_root

logger = logging.getLogger("policylab.repositories.seed")

_DEFAULT_SETTINGS: list[tuple[str, object, str]] = [
    ("default_city", "Athens", "Προεπιλεγμένη πόλη"),
    ("ui_locale_default", "el", "Προεπιλεγμένη γλώσσα διεπαφής"),
    ("max_ai_records", 200, "Μέγιστος αριθμός εγγράφων για την ΤΝ"),
    ("rate_limit_per_minute", 120, "Όριο αιτημάτων ανά λεπτό"),
]


async def seed_registry() -> bool:
    """Seed data_sources / connectors / city_areas / feature_flags / cities / settings /
    model_registry from the YAML catalog. NON-FATAL — returns False on failure."""
    try:
        from app.repositories.sources import catalog_sources, load_catalog, upsert_connector, upsert_source

        entries = catalog_sources()
        for entry in entries:
            try:
                await upsert_source(entry)
                await upsert_connector(entry)
            except Exception as exc:  # noqa: BLE001
                logger.warning("seed: αποτυχία πηγής %s: %s", entry.get("name"), exc)
        logger.info("seed: %d πηγές από catalog.yaml", len(entries))
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed sources απέτυχε (μη κρίσιμο): %s", exc)

    try:
        catalog = load_catalog()
        for area in catalog.get("city_areas") or []:
            if isinstance(area, dict) and area.get("id"):
                from app.repositories.city import upsert_area

                await upsert_area(area)
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed city_areas απέτυχε (μη κρίσιμο): %s", exc)

    try:
        await _seed_feature_flags()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed feature_flags απέτυχε (μη κρίσιμο): %s", exc)

    try:
        await _seed_cities()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed cities απέτυχε (μη κρίσιμο): %s", exc)

    try:
        await _seed_settings()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed settings απέτυχε (μη κρίσιμο): %s", exc)

    try:
        await _seed_models()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed model_registry απέτυχε (μη κρίσιμο): %s", exc)

    try:
        await _seed_api_registry()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed api_registry �?I?I-I,I.I�I� (I�I� I�I?I_I�I1I�I�): %s", exc)

    try:
        await _seed_city_features()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed city_features ���?I?I-I,I.I���I��� (I���I��� I���I?I_I���I1I���I���): %s", exc)

    try:
        await _seed_govtech()
    except Exception as exc:  # noqa: BLE001
        logger.warning("seed govtech ���?I?I-I,I.I���I��� (I���I��� I���I?I_I���I1I���I���): %s", exc)

    return True


async def _seed_feature_flags() -> None:
    from sqlalchemy import select

    from app.database import session_scope
    from app.models import FeatureFlag
    from app.repositories.admin import DEFAULT_FLAGS

    async with session_scope() as session:
        existing = {
            row.name
            for row in (
                (await session.execute(select(FeatureFlag))).scalars()
            )
        }
        for flag in DEFAULT_FLAGS:
            if flag["name"] not in existing:
                session.add(
                    FeatureFlag(
                        name=flag["name"],
                        enabled=bool(flag["enabled"]),
                        description=flag.get("description"),
                    )
                )


async def _seed_cities() -> None:
    from sqlalchemy import select

    from app.database import session_scope
    from app.models import City

    async with session_scope() as session:
        existing = (await session.execute(select(City))).scalars().first()
        if existing is None:
            session.add(
                City(
                    name="Athens",
                    name_el="Αθήνα",
                    country="GR",
                    lat=37.9838,
                    lon=23.7275,
                    bbox=[23.6, 37.9, 24.1, 38.1],
                )
            )


async def _seed_settings() -> None:
    from sqlalchemy import select

    from app.database import session_scope
    from app.models import Setting

    async with session_scope() as session:
        existing = {row.key for row in ((await session.execute(select(Setting))).scalars())}
        for key, value, description in _DEFAULT_SETTINGS:
            if key not in existing:
                session.add(
                    Setting(
                        key=key,
                        value={"value": value},
                        description=description,
                    )
                )


async def _seed_models() -> None:
    from sqlalchemy import select

    from app.database import session_scope
    from app.models import ModelRegistry
    from services.simulation_engine.registry import list_models

    specs = list_models()
    async with session_scope() as session:
        existing = {
            row.name
            for row in ((await session.execute(select(ModelRegistry))).scalars())
        }
        for spec in specs:
            if spec.name not in existing:
                session.add(
                    ModelRegistry(
                        name=spec.name,
                        version=spec.version,
                        category=spec.category,
                        description=spec.description,
                        parameters=spec.parameters,
                    )
                )


async def _seed_api_registry() -> None:
    """Record the endpoint catalogue (contract §2) for /v1/admin introspection."""
    from sqlalchemy import select

    from app.database import session_scope
    from app.models import ApiRegistry

    from app.api.v1.router import ROUTE_CATALOG

    async with session_scope() as session:
        existing = {
            (row.method, row.path)
            for row in ((await session.execute(select(ApiRegistry))).scalars())
        }
        for method, path, summary, module in ROUTE_CATALOG:
            if (method, path) not in existing:
                session.add(
                    ApiRegistry(method=method, path=path, summary=summary, module=module)
                )


def catalog_root_note() -> str:
    return str(repo_root() / "data" / "source-registry" / "catalog.yaml")


def _demo_city_features() -> list[dict]:
    """Deterministic demo features for the Digital Twin (SQLite / no-OSM mode)."""
    import json
    import math
    import random

    rnd = random.Random(42)
    lat0, lon0 = 37.9838, 23.7275
    features: list[dict] = []

    def add(layer: str, fid: str, geometry: dict, properties: dict) -> None:
        features.append(
            {
                "id": f"{layer}:{fid}",
                "layer": layer,
                "properties": properties,
                "geom": json.dumps(geometry, ensure_ascii=False),
            }
        )

    def jitter(scale: float = 0.012) -> tuple[float, float]:
        return lat0 + rnd.uniform(-scale, scale), lon0 + rnd.uniform(-scale, scale)

    def square(lat: float, lon: float, d: float) -> dict:
        return {
            "type": "Polygon",
            "coordinates": [
                [
                    [lon - d, lat - d],
                    [lon + d, lat - d],
                    [lon + d, lat + d],
                    [lon - d, lat + d],
                    [lon - d, lat - d],
                ]
            ],
        }

    streets = [
        "Πανεπιστημίου", "Σταδίου", "Ακαδημίας", "Πατησίων", "Σόλωνος",
        "Ιπποκράτους", "Ασκληπιού", "Μασσαλίας", "Χαριλάου Τρικούπη", "Βασιλίσσης Σοφίας",
    ]
    for i in range(60):
        lat, lon = jitter()
        add(
            "buildings",
            f"b{i:03d}",
            square(lat, lon, 0.00035),
            {
                "name": f"Κτίριο {i + 1}",
                "height": rnd.choice([12, 15, 18, 21, 24, 27, 30]),
                "levels": rnd.randint(3, 9),
                "street": rnd.choice(streets),
                "source": "demo",
            },
        )

    for i in range(14):
        lat = lat0 + (i - 7) * 0.0022
        lon = lon0 + math.sin(i) * 0.004
        add(
            "roads",
            f"r{i:02d}",
            {
                "type": "LineString",
                "coordinates": [
                    [lon - 0.008, lat - 0.001],
                    [lon, lat],
                    [lon + 0.008, lat + 0.001],
                ],
            },
            {
                "name": streets[i % len(streets)],
                "highway": "primary" if i % 3 == 0 else "secondary",
                "lanes": rnd.choice([1, 2, 3, 4]),
                "source": "demo",
            },
        )

    parks = [
        ("Εθνικός Κήπος", 37.9736, 23.7361, 155_000, "garden"),
        ("Πεδίον του Άρεως", 37.9922, 23.7357, 210_000, "park"),
        ("Λόφος Λυκαβηττού", 37.9821, 23.7430, 410_000, "park"),
        ("Πλατεία Εξαρχείων", 37.9865, 23.7348, 8_000, "park"),
        ("Άλσος Βεΐκου", 38.0155, 23.7570, 150_000, "park"),
        ("Πάρκο Ριζάρη", 37.9783, 23.7467, 25_000, "park"),
        ("Πλατεία Κυψέλης", 38.0022, 23.7338, 4_000, "park"),
        ("Λόφος Φιλοπάππου", 37.9672, 23.7208, 420_000, "park"),
    ]
    for i, (name, lat, lon, area_m2, kind) in enumerate(parks):
        d = math.sqrt(area_m2) / 2 / 111_000
        add(
            "green_spaces",
            f"g{i:02d}",
            square(lat, lon, d),
            {
                "name": name,
                "area_m2": area_m2,
                "type": kind,
                "source": "demo",
            },
        )

    point_layers = [
        ("schools", 14, ["1ο Δημοτικό", "2ο Γυμνάσιο", "Λύκειο Εξαρχείων", "Νηπιαγωγείο"]),
        ("hospitals", 8, ["Νοσοκομείο", "Πολυκλινική", "Κέντρο Υγείας", "Ιατρείο"]),
        ("public_facilities", 10, ["Δημαρχείο", "Αστυνομικό Τμήμα", "ΚΕΠ", "Βιβλιοθήκη"]),
        ("pois", 36, ["Καφετέρια", "Εστιατόριο", "Φαρμακείο", "Μουσείο", "Θέατρο", "Αγορά"]),
    ]
    for layer, count, names in point_layers:
        for i in range(count):
            lat, lon = jitter(0.011)
            add(
                layer,
                f"p{i:03d}",
                {"type": "Point", "coordinates": [lon, lat]},
                {
                    "name": f"{rnd.choice(names)} {i + 1}",
                    "source": "demo",
                    "capacity": rnd.randint(20, 400) if layer != "pois" else None,
                },
            )

    areas = [
        ("exarchia", 37.9880, 23.7330, 12800),
        ("kolonaki", 37.9790, 23.7430, 9400),
        ("kerameikos", 37.9780, 23.7170, 8600),
        ("kypseli", 38.0000, 23.7350, 15400),
        ("pagkrati", 37.9650, 23.7480, 11200),
        ("metaxourgeio", 37.9850, 23.7230, 7300),
    ]
    for i, (area, lat, lon, density) in enumerate(areas):
        add(
            "population",
            f"pop{i:02d}",
            {"type": "Point", "coordinates": [lon, lat]},
            {
                "name": area,
                "density_per_km2": density,
                "population": density * 2,
                "source": "demo",
            },
        )

    return features


async def _seed_city_features() -> None:
    """Populate demo city_features on SQLite (PostGIS deployments import OSM instead)."""
    from sqlalchemy import func, select

    from app.database import engine, session_scope
    from app.models import CityFeature

    if engine.url.get_backend_name() != "sqlite":
        return
    async with session_scope() as session:
        existing = (
            await session.execute(select(func.count(CityFeature.id)))
        ).scalar_one()
        if existing:
            return
        for item in _demo_city_features():
            session.add(CityFeature(**item))
    logger.info("seed: demo city_features (SQLite)")

def _demo_projects() -> list[dict]:
    """Deterministic demo projects for the Public Project Tracker (SQLite / no live feeds)."""
    return [
        {
            "id": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
            "name": "Πεζοδρόμηση της Πανεπιστημίου",
            "status": "in_progress",
            "org": "Δήμος Αθηναίων",
            "budget": 1850000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [23.7280, 37.9800],
                    [23.7301, 37.9822],
                    [23.7324, 37.9841],
                ],
            },
        },
        {
            "id": "b2c3d4e5f60718293a4b5c6d7e8f9012",
            "name": "Ανάπλαση της Πλατείας Εξαρχείων",
            "status": "in_progress",
            "org": "Δήμος Αθηναίων",
            "budget": 2450000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [23.7315, 37.9855],
                    [23.7352, 37.9855],
                    [23.7352, 37.9882],
                    [23.7315, 37.9882],
                    [23.7315, 37.9855],
                ]],
            },
        },
        {
            "id": "c3d4e5f60718293a4b5c6d7e8f901234",
            "name": "Νέο Σχολικό Συγκρότημα στα Πατήσια",
            "status": "planned",
            "org": "Δήμος Αθηναίων",
            "budget": 8900000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {"type": "Point", "coordinates": [23.7325, 38.0120]},
        },
        {
            "id": "d4e5f60718293a4b5c6d7e8f90123456",
            "name": "Ανάπλαση Πεζοδρομίων Κυψέλης",
            "status": "completed",
            "org": "Δήμος Αθηναίων",
            "budget": 3200000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [23.7300, 37.9950],
                    [23.7385, 37.9950],
                    [23.7385, 38.0010],
                    [23.7300, 38.0010],
                    [23.7300, 37.9950],
                ]],
            },
        },
        {
            "id": "e5f60718293a4b5c6d7e8f9012345678",
            "name": "Επέκταση Ποδηλατοδρόμου Κέντρου",
            "status": "construction",
            "org": "Δήμος Αθηναίων",
            "budget": 4050000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [23.7190, 37.9750],
                    [23.7245, 37.9780],
                    [23.7290, 37.9762],
                ],
            },
        },
        {
            "id": "f60718293a4b5c6d7e8f901234567890",
            "name": "Ανακαίνιση Λαϊκής Αγοράς Κυψέλης",
            "status": "delayed",
            "org": "Δήμος Αθηναίων",
            "budget": 950000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [23.7330, 37.9980],
                    [23.7355, 37.9980],
                    [23.7355, 38.0000],
                    [23.7330, 38.0000],
                    [23.7330, 37.9980],
                ]],
            },
        },
        {
            "id": "0718293a4b5c6d7e8f901234567890ab",
            "name": "Ανάπλαση Πάρκου Τσέχων και Σλοβάκων",
            "status": "completed",
            "org": "Δήμος Αθηναίων",
            "budget": 1600000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [23.7430, 37.9820],
                    [23.7475, 37.9820],
                    [23.7475, 37.9855],
                    [23.7430, 37.9855],
                    [23.7430, 37.9820],
                ]],
            },
        },
        {
            "id": "18293a4b5c6d7e8f901234567890abcd",
            "name": "Ψηφιακός Εκσυγχρονισμός Δήμου Αθηναίων",
            "status": "in_progress",
            "org": "Δήμος Αθηναίων",
            "budget": 1100000.0,
            "url": "https://www.cityofathens.gr/",
            "geometry": None,
        },
    ]


def _demo_decisions() -> list[dict]:
    """Deterministic demo decisions linked to the demo projects."""
    rows = [
        ("Ανάληψη υποχρέωσης για την πεζοδρόμηση της οδού Πανεπιστημίου",
         "Απόφαση Ανάληψης Υποχρέωσης", "2024-03-12", "a1b2c3d4e5f60718293a4b5c6d7e8f90"),
        ("Έγκριση μελέτης πεζοδρόμησης Πανεπιστημίου",
         "Έγκριση Μελέτης", "2024-01-22", "a1b2c3d4e5f60718293a4b5c6d7e8f90"),
        ("Δημοπράτηση ανάπλασης Πλατείας Εξαρχείων",
         "Διακήρυξη Διαγωνισμού", "2023-11-08", "b2c3d4e5f60718293a4b5c6d7e8f9012"),
        ("Σύμβαση κατασκευής ανάπλασης Πλατείας Εξαρχείων",
         "Σύμβαση", "2024-02-19", "b2c3d4e5f60718293a4b5c6d7e8f9012"),
        ("Πρωτόκολλο προσωρινής παραλαβής πεζοδρομίων Κυψέλης",
         "Πρωτόκολλο Παραλαβής", "2023-09-27", "d4e5f60718293a4b5c6d7e8f90123456"),
        ("Έγκριση περιβαλλοντικών όρων σχολικού συγκροτήματος Πατησίων",
         "Απόφαση Έγκρισης", "2025-02-04", "c3d4e5f60718293a4b5c6d7e8f901234"),
        ("Χρηματοδότηση επέκτασης ποδηλατοδρόμου Κέντρου",
         "Απόφαση Χρηματοδότησης", "2024-06-14", "e5f60718293a4b5c6d7e8f9012345678"),
        ("Τροποποίηση σύμβασης ανακαίνισης Λαϊκής Αγοράς Κυψέλης",
         "Τροποποίηση Σύμβασης", "2025-01-16", "f60718293a4b5c6d7e8f901234567890"),
        ("Ολοκλήρωση ανάπλασης Πάρκου Τσέχων και Σλοβάκων",
         "Πρωτόκολλο Οριστικής Παραλαβής", "2023-12-05", "0718293a4b5c6d7e8f901234567890ab"),
        ("Έγκριση ψηφιακού μετασχηματισμού Δήμου Αθηναίων",
         "Απόφαση Δημοτικού Συμβουλίου", "2024-10-09", "18293a4b5c6d7e8f901234567890abcd"),
        ("Παράταση προθεσμίας ανακαίνισης Λαϊκής Αγοράς Κυψέλης",
         "Απόφαση Παράτασης", "2025-06-30", "f60718293a4b5c6d7e8f901234567890"),
        ("Έγκριση κυκλοφοριακών ρυθμίσεων πεζοδρόμησης Πανεπιστημίου",
         "Απόφαση Κυκλοφοριακών Ρυθμίσεων", "2024-05-21", "a1b2c3d4e5f60718293a4b5c6d7e8f90"),
    ]
    out = []
    for i, (title, dtype, date, project_id) in enumerate(rows, start=1):
        out.append(
            {
                "id": f"dec{i:026d}",
                "title": title,
                "org": "Δήμος Αθηναίων",
                "decision_type": dtype,
                "date": date,
                "url": "https://diavgeia.gov.gr/search?query=" + title.replace(" ", "+"),
                "project_id": project_id,
                "extra": {"source": "demo", "project_id": project_id},
            }
        )
    return out


async def _seed_govtech() -> None:
    """Populate demo decisions/projects when the live feeds are unavailable."""
    from sqlalchemy import func, select

    from app.database import session_scope
    from app.models import Decision, Project

    async with session_scope() as session:
        project_count = (await session.execute(select(func.count(Project.id)))).scalar_one()
        if not project_count:
            for item in _demo_projects():
                session.add(Project(**item))
        decision_count = (await session.execute(select(func.count(Decision.id)))).scalar_one()
        if not decision_count:
            for item in _demo_decisions():
                session.add(Decision(**item))
    logger.info("seed: demo govtech decisions/projects")


