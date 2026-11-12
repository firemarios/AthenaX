"""Model registry (contract §5.5): ModelSpec (matches TS ModelSpec) + MODELS classes."""
from __future__ import annotations

from services.simulation_engine.model_spec import ModelSpec

# Imported at the bottom: model modules import ModelSpec from model_spec (leaf, no cycle).
from services.simulation_engine.models import (  # noqa: E402
    AccessibilityModel,
    CostModel,
    GreenspaceModel,
    TrafficSumoModel,
)

MODELS: dict[str, type] = {
    "accessibility": AccessibilityModel,
    "greenspace": GreenspaceModel,
    "traffic_sumo": TrafficSumoModel,
    "cost": CostModel,
}


def list_models() -> list[ModelSpec]:
    return [cls.SPEC for cls in MODELS.values()]


def get_model(name: str) -> ModelSpec:
    """KeyError for unknown model names (contract §5.5)."""
    return MODELS[name].SPEC


def get_model_class(name: str) -> type:
    """Model implementation class (raises KeyError for unknown names)."""
    return MODELS[name]


__all__ = ["ModelSpec", "MODELS", "list_models", "get_model", "get_model_class"]
