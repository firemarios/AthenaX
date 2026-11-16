"""Shared connector primitives — build contract (docs/architecture/contracts.md §5.1)."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("athenax.connectors")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class NormalizedRecord:
    title: str
    source_name: str
    source_url: str
    description: str | None = None
    provider: str | None = None
    license: str | None = None
    category: str | None = None
    tags: list[str] = field(default_factory=list)
    published_at: datetime | None = None
    updated_at: datetime | None = None
    lat: float | None = None
    lon: float | None = None
    geometry: dict | None = None
    extra: dict = field(default_factory=dict)
    fetched_at: datetime = field(default_factory=utcnow)
    reliability: float = 0.8

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "source_name": self.source_name,
            "source_url": self.source_url,
            "description": self.description,
            "provider": self.provider,
            "license": self.license,
            "category": self.category,
            "tags": list(self.tags),
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "lat": self.lat,
            "lon": self.lon,
            "geometry": self.geometry,
            "extra": dict(self.extra),
            "fetched_at": self.fetched_at.isoformat(),
            "reliability": self.reliability,
        }


class BaseConnector:
    """Base class every source connector implements."""

    name: str = "base"
    kind: str = "base"
    source_url: str = ""
    default_reliability: float = 0.8

    def __init__(
        self,
        endpoint_url: str = "",
        enabled: bool = True,
        config: dict[str, Any] | None = None,
    ) -> None:
        self.endpoint_url = endpoint_url or self.source_url
        self.enabled = enabled
        self.config = dict(config or {})

    async def fetch(self, query: str | None = None, limit: int = 50) -> Any:
        raise NotImplementedError

    async def normalize(self, raw: Any) -> list[NormalizedRecord]:
        raise NotImplementedError

    async def search(self, query: str | None = None, limit: int = 50) -> list[NormalizedRecord]:
        """fetch + normalize; never raises — returns [] on failure."""
        if not self.enabled:
            return []
        try:
            raw = await self.fetch(query=query, limit=limit)
            records = await self.normalize(raw)
            return list(records[:limit]) if records else []
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s search failed: %s", self.name, exc)
            return []

    async def health(self) -> dict[str, Any]:
        checked_at = utcnow().isoformat()
        if not self.enabled:
            return {
                "status": "down",
                "latency_ms": None,
                "detail": "συνθήκη απενεργοποίησης",
                "checked_at": checked_at,
            }
        url = self.endpoint_url or self.source_url
        if not url:
            return {
                "status": "unknown",
                "latency_ms": None,
                "detail": "κανένα endpoint",
                "checked_at": checked_at,
            }
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
            latency = int((time.perf_counter() - started) * 1000)
            if resp.status_code < 400:
                status = "healthy"
            elif resp.status_code < 500:
                status = "degraded"
            else:
                status = "down"
            return {
                "status": status,
                "latency_ms": latency,
                "detail": f"HTTP {resp.status_code}",
                "checked_at": checked_at,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "status": "down",
                "latency_ms": None,
                "detail": str(exc)[:200],
                "checked_at": checked_at,
            }
