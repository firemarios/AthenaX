"""SQLAlchemy 2.0 ORM models — every table from contracts §5.7 + §9.2.

Conventions: String(32) uuid4().hex primary keys, created_at/updated_at with utcnow
defaults, JSONB (via JSON variant) on PostgreSQL, GeoAlchemy2 Geometry for city_features
(tolerated at runtime when the DB has no PostGIS — sessions are mocked in tests).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.database import Base
from geoalchemy2 import Geometry
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


def _new_id() -> str:
    return uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UUIDPkMixin:
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class DataSource(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(300))
    provider: Mapped[str | None] = mapped_column(String(200))
    source_type: Mapped[str | None] = mapped_column(String(50), index=True)
    base_url: Mapped[str | None] = mapped_column(String(500))
    endpoint_url: Mapped[str | None] = mapped_column(String(500))
    license: Mapped[str | None] = mapped_column(String(300))
    update_frequency: Mapped[str | None] = mapped_column(String(50))
    reliability: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str | None] = mapped_column(String(30), default="unknown")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[str | None] = mapped_column(String(10))
    last_checked_at: Mapped[str | None] = mapped_column(String(40))
    config: Mapped[dict | None] = mapped_column(JSON_TYPE)


class Dataset(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "datasets"

    title: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(200))
    # provenance columns (contracts §5.7)
    source_id: Mapped[str | None] = mapped_column(String(32), index=True)
    source_name: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(String(500))
    license: Mapped[str | None] = mapped_column(String(300))
    last_updated: Mapped[str | None] = mapped_column(String(40))
    fetched_at: Mapped[str | None] = mapped_column(String(40))
    checksum: Mapped[str | None] = mapped_column(String(128))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON_TYPE)
    format: Mapped[str | None] = mapped_column(String(50))
    geographic_scope: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    tags: Mapped[list | None] = mapped_column(JSON_TYPE)
    quality: Mapped[dict | None] = mapped_column(JSON_TYPE)
    provenance: Mapped[dict | None] = mapped_column(JSON_TYPE)
    resources: Mapped[list | None] = mapped_column(JSON_TYPE)
    related_ids: Mapped[list | None] = mapped_column(JSON_TYPE)


class DatasetVersion(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "dataset_versions"

    dataset_id: Mapped[str] = mapped_column(String(32), index=True)
    version: Mapped[str | None] = mapped_column(String(100))
    checksum: Mapped[str | None] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text)


class DataQualityReport(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "data_quality_reports"

    dataset_id: Mapped[str] = mapped_column(String(32), index=True)
    completeness: Mapped[float | None] = mapped_column(Float)
    freshness: Mapped[float | None] = mapped_column(Float)
    validity: Mapped[float | None] = mapped_column(Float)
    validation_status: Mapped[str | None] = mapped_column(String(20))
    computed_at: Mapped[str | None] = mapped_column(String(40))


class Document(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "documents"

    title: Mapped[str] = mapped_column(String(500))
    doc_type: Mapped[str | None] = mapped_column(String(50))
    source_url: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON_TYPE)


class Decision(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "decisions"

    title: Mapped[str] = mapped_column(String(1000), index=True)
    org: Mapped[str | None] = mapped_column(String(300), index=True)
    decision_type: Mapped[str | None] = mapped_column(String(100))
    date: Mapped[str | None] = mapped_column(String(40), index=True)
    url: Mapped[str | None] = mapped_column(String(500))
    project_id: Mapped[str | None] = mapped_column(String(32), index=True)
    extra: Mapped[dict | None] = mapped_column(JSON_TYPE)


class Project(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(500), index=True)
    status: Mapped[str | None] = mapped_column(String(50), index=True)
    org: Mapped[str | None] = mapped_column(String(300))
    budget: Mapped[float | None] = mapped_column(Float)
    url: Mapped[str | None] = mapped_column(String(500))
    geometry: Mapped[dict | None] = mapped_column(JSON_TYPE)


class Connector(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "connectors"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(300))
    endpoint_url: Mapped[str | None] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(String(500))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str | None] = mapped_column(String(30), default="unknown")
    last_checked_at: Mapped[str | None] = mapped_column(String(40))
    config: Mapped[dict | None] = mapped_column(JSON_TYPE)


class City(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "cities"

    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name_el: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(80))
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    bbox: Mapped[list | None] = mapped_column(JSON_TYPE)


class FeatureFlag(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "feature_flags"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)


class Setting(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    value: Mapped[dict | None] = mapped_column(JSON_TYPE)
    description: Mapped[str | None] = mapped_column(Text)


class Policy(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "policies"

    title: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    changes: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), index=True, default="other")
    status: Mapped[str | None] = mapped_column(String(30), default="draft")
    area: Mapped[str | None] = mapped_column(String(200))
    horizon: Mapped[str | None] = mapped_column(String(100))
    parameters: Mapped[dict | None] = mapped_column(JSON_TYPE)
    factors: Mapped[list | None] = mapped_column(JSON_TYPE)
    budget_eur: Mapped[float | None] = mapped_column(Float)
    assumptions: Mapped[list | None] = mapped_column(JSON_TYPE)
    kpis: Mapped[list | None] = mapped_column(JSON_TYPE)


class PolicyVariant(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "policy_variants"

    policy_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(500))
    parameters: Mapped[dict | None] = mapped_column(JSON_TYPE)


class SimulationRun(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "simulation_runs"

    policy_id: Mapped[str | None] = mapped_column(String(32), index=True)
    model_name: Mapped[str] = mapped_column(String(100), index=True)
    model_version: Mapped[str | None] = mapped_column(String(50))
    parameters: Mapped[dict | None] = mapped_column(JSON_TYPE)
    results: Mapped[dict | None] = mapped_column(JSON_TYPE)
    passport: Mapped[dict | None] = mapped_column(JSON_TYPE)
    status: Mapped[str | None] = mapped_column(String(20), default="queued", index=True)
    error: Mapped[str | None] = mapped_column(Text)
    seed: Mapped[int | None] = mapped_column(Integer)


class ModelRegistry(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "model_registry"

    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    version: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[dict | None] = mapped_column(JSON_TYPE)
    parameters: Mapped[list | None] = mapped_column(JSON_TYPE)


class ImpactMetric(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "impact_metrics"

    run_id: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(100))
    label: Mapped[dict | None] = mapped_column(JSON_TYPE)
    baseline: Mapped[float | None] = mapped_column(Float)
    value: Mapped[float | None] = mapped_column(Float)
    delta: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(50))
    direction: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Float)


class Consultation(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "consultations"

    title: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(30), default="open", index=True)
    starts_at: Mapped[str | None] = mapped_column(String(40))
    ends_at: Mapped[str | None] = mapped_column(String(40))


class Proposal(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "proposals"

    title: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[str] = mapped_column(Text)
    area: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(String(30), default="open", index=True)
    consultation_id: Mapped[str | None] = mapped_column(String(32), index=True)


class Comment(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "comments"

    proposal_id: Mapped[str] = mapped_column(String(32), index=True)
    body: Mapped[str] = mapped_column(Text)


class ResearchProject(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "research_projects"

    name: Mapped[str] = mapped_column(String(500), index=True)
    description: Mapped[str | None] = mapped_column(Text)


class Experiment(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "experiments"

    project_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(500))
    model: Mapped[str | None] = mapped_column(String(100))
    run_ids: Mapped[list | None] = mapped_column(JSON_TYPE)
    notes: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(500))
    status: Mapped[int | None] = mapped_column(Integer)
    ip: Mapped[str | None] = mapped_column(String(60))
    request_id: Mapped[str | None] = mapped_column(String(64), index=True)


class ApiRegistry(Base, UUIDPkMixin, TimestampMixin):
    __tablename__ = "api_registry"

    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str | None] = mapped_column(String(500))
    module: Mapped[str | None] = mapped_column(String(100))


class CityFeature(Base):
    """city_features (contracts §9.2) — TEXT id, JSONB properties, PostGIS Geometry."""

    __tablename__ = "city_features"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    layer: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    properties: Mapped[dict | None] = mapped_column(JSON_TYPE)
    geom: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="Geometry", srid=4326, spatial_index=False).with_variant(
            Text(), "sqlite"
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class CityArea(Base):
    """city_areas (contracts §9.2) — seeded from data/source-registry/catalog.yaml."""

    __tablename__ = "city_areas"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name_el: Mapped[str | None] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    radius_m: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


__all__ = [
    "ApiRegistry",
    "AuditLog",
    "Base",
    "City",
    "CityArea",
    "CityFeature",
    "Comment",
    "Connector",
    "Consultation",
    "DataQualityReport",
    "DataSource",
    "Dataset",
    "DatasetVersion",
    "Decision",
    "Document",
    "Experiment",
    "FeatureFlag",
    "ImpactMetric",
    "ModelRegistry",
    "Policy",
    "PolicyVariant",
    "Project",
    "Proposal",
    "ResearchProject",
    "Setting",
    "SimulationRun",
]
