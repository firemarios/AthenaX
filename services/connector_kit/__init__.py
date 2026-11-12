"""Connector kit: shared base + connector catalog. See docs/architecture/contracts.md §5.1/§5.2."""
from services.connector_kit.base import BaseConnector, NormalizedRecord, utcnow

__all__ = ["BaseConnector", "NormalizedRecord", "utcnow", "CONNECTOR_CLASSES"]


def __getattr__(name: str):
    if name == "CONNECTOR_CLASSES":
        from services.connector_kit.catalog import CONNECTOR_CLASSES
        return CONNECTOR_CLASSES
    raise AttributeError(name)
