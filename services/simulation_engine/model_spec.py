"""ModelSpec dataclass (matches TS ModelSpec) — leaf module to avoid circular imports.

Re-exported from services.simulation_engine.registry per contract §5.5.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ModelSpec:
    name: str
    version: str
    category: str
    description: dict  # {el, en}
    label: dict = field(default_factory=dict)  # {el, en}
    parameters: list[dict] = field(default_factory=list)
