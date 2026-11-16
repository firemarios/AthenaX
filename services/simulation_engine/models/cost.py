"""Cost model: expected / low / high cost ranges from unit costs (contract §5.5)."""
from __future__ import annotations

from services.simulation_engine.model_spec import ModelSpec


class CostModel:
    name = "cost"

    SPEC = ModelSpec(
        name="cost",
        version="1.0.0",
        category="economy",
        description={
            "el": "Εκτίμηση κόστους: αναμενόμενο, χαμηλό και υψηλό εύρος από μοναδικό κόστος και ποσότητα.",
            "en": "Cost estimate: expected / low / high ranges from unit cost and quantity.",
        },
        label={"el": "Κόστος έργου", "en": "Project cost"},
        parameters=[
            {
                "name": "unit_cost_eur",
                "type": "float",
                "default": 250.0,
                "min": 0.0,
                "max": 10_000_000.0,
                "label": {"el": "Μοναδιαίο κόστος (€)", "en": "Unit cost (EUR)"},
            },
            {
                "name": "length_m",
                "type": "int",
                "default": 1000,
                "min": 0,
                "max": 1_000_000,
                "label": {"el": "Μήκος (μ) — γραμμικά έργα", "en": "Length (m) — linear works"},
            },
            {
                "name": "area_m2",
                "type": "int",
                "default": 0,
                "min": 0,
                "max": 10_000_000,
                "label": {"el": "Εμβαδόν (m²) — επιφανειακά έργα", "en": "Area (m²) — surface works"},
            },
            {
                "name": "contingency_pct",
                "type": "float",
                "default": 10.0,
                "min": 0.0,
                "max": 100.0,
                "label": {"el": "Απρόβλεπτα (%)", "en": "Contingency (%)"},
            },
        ],
    )

    ASSUMPTIONS = [
        "Βασικό κόστος = μοναδιαίο κόστος × ποσότητα (μήκος ή εμβαδόν).",
        "Χαμηλό εύρος = 85% του βασικού, αναμενόμενο = βασικό × (1 + απρόβλεπτα), υψηλό = αναμενόμενο × 1,15.",
        "Οι τιμές είναι σταθερές (χωρίς πληθωρισμό ή αστοχία κόστους πέρα από τα απρόβλεπτα).",
    ]

    def run(self, parameters: dict, *, snapshot: dict | None = None, seed: int = 42) -> dict:
        warnings: list[str] = []
        unit = max(0.0, float(parameters.get("unit_cost_eur", 250.0)))
        length_m = max(0.0, float(parameters.get("length_m", 1000)))
        area_m2 = max(0.0, float(parameters.get("area_m2", 0)))
        contingency = max(0.0, float(parameters.get("contingency_pct", 10.0))) / 100.0

        quantity = length_m if length_m > 0 else area_m2
        basis = "length_m" if length_m > 0 else "area_m2"
        if length_m <= 0 and area_m2 <= 0:
            warnings.append("Μηδενική ποσότητα (length_m και area_m2) — κόστος 0 €.")
        if length_m > 0 and area_m2 > 0:
            warnings.append("Και οι δύο ποσότητες ορίστηκαν — χρήση length_m ως βάσης.")

        base = unit * quantity
        low = base * 0.85
        expected = base * (1.0 + contingency)
        high = expected * 1.15

        metrics = {
            "cost_eur": round(expected, 2),
            "cost_low_eur": round(low, 2),
            "cost_high_eur": round(high, 2),
        }

        return {
            "metrics": metrics,
            "assumptions": list(self.ASSUMPTIONS),
            "warnings": warnings,
            "uncertainty": {
                "cost_eur": [round(low, 2), round(high, 2)],
            },
            "logs": [
                f"basis={basis}",
                f"quantity={quantity:g}",
                f"unit_cost_eur={unit:g}",
                "mode=analytic",
            ],
        }


__all__ = ["CostModel"]
