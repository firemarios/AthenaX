"""Connector catalog: name → connector class (contract §5.2 / §9.1).

Keys MUST match data/source-registry/catalog.yaml sources:
  ckan, diavgeia, athens, kimdis, elstat, eurostat, overpass, openmeteo, data_europa,
  wikipedia, websearch
"""
from __future__ import annotations

from services.connector_kit.base import BaseConnector
from services.govtech_connectors.athens import AthensConnector
from services.govtech_connectors.diavgeia import DiavgeiaConnector
from services.govtech_connectors.elstat import ElstatConnector
from services.govtech_connectors.kimdis import KimdisConnector
from services.open_data_connectors.ckan import CkanConnector
from services.open_data_connectors.data_europa import DataEuropaConnector
from services.open_data_connectors.eurostat import EurostatConnector
from services.open_data_connectors.openmeteo import OpenMeteoConnector
from services.open_data_connectors.overpass import OverpassConnector
from services.open_data_connectors.websearch import WebSearchConnector
from services.open_data_connectors.wikipedia import WikipediaConnector

CONNECTOR_CLASSES: dict[str, type[BaseConnector]] = {
    "ckan": CkanConnector,
    "diavgeia": DiavgeiaConnector,
    "athens": AthensConnector,
    "kimdis": KimdisConnector,
    "elstat": ElstatConnector,
    "eurostat": EurostatConnector,
    "overpass": OverpassConnector,
    "openmeteo": OpenMeteoConnector,
    "data_europa": DataEuropaConnector,
    "wikipedia": WikipediaConnector,
    "websearch": WebSearchConnector,
}

__all__ = ["CONNECTOR_CLASSES"]
