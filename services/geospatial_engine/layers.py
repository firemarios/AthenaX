"""Layer registry for the Digital Twin (Module 04) — pure metadata, no DB access."""

from __future__ import annotations

LAYER_REGISTRY: dict[str, dict] = {
    "buildings": {
        "title": {"el": "Κτίρια", "en": "Buildings"},
        "geometry_type": "Polygon",
        "source": "OpenStreetMap",
        "description": {
            "el": "Αποτυπώματα κτιρίων και διαθέσιμα ύψη",
            "en": "Building footprints and available heights",
        },
        "table": "city_features",
    },
    "roads": {
        "title": {"el": "Οδικό δίκτυο", "en": "Road network"},
        "geometry_type": "LineString",
        "source": "OpenStreetMap",
        "description": {"el": "Κεντρικές και δευτερεύουσες οδοί", "en": "Primary and secondary roads"},
        "table": "city_features",
    },
    "green_spaces": {
        "title": {"el": "Πράσινοι χώροι", "en": "Green spaces"},
        "geometry_type": "Polygon",
        "source": "OpenStreetMap",
        "description": {"el": "Πάρκα, κήποι και δασικές εκτάσεις", "en": "Parks, gardens and forest areas"},
        "table": "city_features",
    },
    "schools": {
        "title": {"el": "Σχολεία", "en": "Schools"},
        "geometry_type": "Point",
        "source": "OpenStreetMap",
        "description": {"el": "Νηπιαγωγεία, δημοτικά, λύκεια", "en": "Kindergartens, primary and secondary schools"},
        "table": "city_features",
    },
    "hospitals": {
        "title": {"el": "Νοσοκομεία & ιατρεία", "en": "Hospitals & clinics"},
        "geometry_type": "Point",
        "source": "OpenStreetMap",
        "description": {"el": "Μονάδες υγείας", "en": "Health facilities"},
        "table": "city_features",
    },
    "public_facilities": {
        "title": {"el": "Δημόσιες υπηρεσίες", "en": "Public facilities"},
        "geometry_type": "Point",
        "source": "OpenStreetMap",
        "description": {"el": "Δημαρχεία, γραφεία, αστυνομικά τμήματα", "en": "City halls, offices, police stations"},
        "table": "city_features",
    },
    "pois": {
        "title": {"el": "Σημεία ενδιαφέροντος", "en": "Points of interest"},
        "geometry_type": "Point",
        "source": "OpenStreetMap",
        "description": {"el": "Καταστήματα, εστιατόρια, υπηρεσίες", "en": "Shops, restaurants, services"},
        "table": "city_features",
    },
    "population": {
        "title": {"el": "Πληθυσμιακή πυκνότητα", "en": "Population density"},
        "geometry_type": "Point",
        "source": "ΕΛΣΤΑΤ / δημοτικά δεδομένα",
        "description": {"el": "Εκτιμώμενη πυκνότητα ανά περιοχή", "en": "Estimated density per area"},
        "table": "city_features",
    },
}


def allowed_layers() -> list[str]:
    return sorted(LAYER_REGISTRY.keys())
