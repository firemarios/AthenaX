"""Async SQLAlchemy engine / sessionmaker / Base (contract §5.7).

`init_db()` is NON-FATAL: it logs a warning and never raises.
"""
from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger("policylab.db")

# Fast-fail circuit breaker: without it every request waits for the TCP/connect
# timeout of an absent Postgres (the UI then appears to "hang").
CONNECT_TIMEOUT = 2.0
PROBE_TIMEOUT = 1.5
RETRY_AFTER_FAILURE = 5.0
RECHECK_AFTER_SUCCESS = 30.0


class Base(DeclarativeBase):
    """Declarative base for all POLICYLAB ORM models."""


engine = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None

_available: bool | None = None
_next_check: float = 0.0
_probe_lock: asyncio.Lock | None = None


def _get_probe_lock() -> asyncio.Lock:
    global _probe_lock
    if _probe_lock is None:
        _probe_lock = asyncio.Lock()
    return _probe_lock


def _init_engine() -> None:
    global engine, AsyncSessionLocal
    try:
        url = (get_settings().database_url or "").strip()
        if not url:
            logger.warning("POLICYLAB_DATABASE_URL κενό — η βάση δεδομένων είναι ανενεργή.")
            engine, AsyncSessionLocal = None, None
            return
        options: dict = {"future": True}
        if not url.startswith("sqlite"):
            options["pool_pre_ping"] = True
            options["pool_timeout"] = CONNECT_TIMEOUT
        if url.startswith("postgresql+asyncpg"):
            options["connect_args"] = {"timeout": CONNECT_TIMEOUT, "command_timeout": 30}
        if url.startswith("sqlite"):
            from pathlib import Path

            target = url.split("///", 1)[-1]
            if target and target not in (":memory:",):
                Path(target).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        engine = create_async_engine(url, **options)
        AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    except Exception as exc:  # noqa: BLE001 — engine creation must never break the app
        logger.warning("Αδυναμία αρχικοποίησης μηχανής βάσης: %s", exc)
        engine, AsyncSessionLocal = None, None


_init_engine()


async def db_available(*, force: bool = False) -> bool:
    """Cheap availability gate. Probes at most once per window, bounded by PROBE_TIMEOUT."""
    global _available, _next_check
    if AsyncSessionLocal is None or engine is None:
        return False
    if _available is True and not force:
        return True
    now = time.monotonic()
    if not force and now < _next_check:
        return False
    async with _get_probe_lock():
        if _available is True and not force:
            return True
        now = time.monotonic()
        if not force and now < _next_check:
            return bool(_available)
        try:
            async with asyncio.timeout(PROBE_TIMEOUT):
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
            _available = True
            _next_check = time.monotonic() + RECHECK_AFTER_SUCCESS
        except Exception as exc:  # noqa: BLE001
            if _available is not False:
                logger.info("Βάση δεδομένων μη διαθέσιμη — λειτουργία fallback (%s)", exc)
            _available = False
            _next_check = time.monotonic() + RETRY_AFTER_FAILURE
        return bool(_available)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Transactional scope. Raises when the DB is unavailable (callers must degrade)."""
    if not await db_available():
        raise RuntimeError("Η βάση δεδομένων δεν είναι διαθέσιμη")
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def ping_db() -> bool:
    """SELECT 1 probe — True when the DB answers."""
    if not await db_available():
        return False
    try:
        async with asyncio.timeout(PROBE_TIMEOUT):
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        global _available, _next_check
        _available = False
        _next_check = time.monotonic() + RETRY_AFTER_FAILURE
        return False


async def _migrate_policy_columns(conn, *, sqlite: bool) -> None:
    """Add policy factor/budget columns to databases created before the feature."""
    try:
        if sqlite:
            result = await conn.execute(text("PRAGMA table_info(policies)"))
            columns = {str(row[1]) for row in result.fetchall()}
            if "changes" not in columns:
                await conn.execute(text("ALTER TABLE policies ADD COLUMN changes TEXT"))
            if "factors" not in columns:
                await conn.execute(text("ALTER TABLE policies ADD COLUMN factors JSON"))
            if "budget_eur" not in columns:
                await conn.execute(text("ALTER TABLE policies ADD COLUMN budget_eur FLOAT"))
        else:
            await conn.execute(
                text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS changes TEXT")
            )
            await conn.execute(
                text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS factors JSONB")
            )
            await conn.execute(
                text(
                    "ALTER TABLE policies ADD COLUMN IF NOT EXISTS budget_eur DOUBLE PRECISION"
                )
            )
    except Exception as exc:  # noqa: BLE001 — optional migration must not block startup
        logger.warning("policy column migration skipped: %s", exc)


async def init_db() -> bool:
    """Create tables when possible. NON-FATAL — logs a warning, never raises."""
    try:
        if AsyncSessionLocal is None or engine is None:
            logger.warning("init_db παραλείφθηκε: μη διαθέσιμη βάση δεδομένων.")
            return False
        if not await db_available(force=True):
            return False
        from app.models import Base as ModelBase

        sqlite = engine.url.get_backend_name() == "sqlite"
        async with asyncio.timeout(30):
            async with engine.begin() as conn:
                if sqlite:
                    # PostGIS types cannot be created on SQLite: create every other
                    # table normally and city_features with a plain TEXT geometry.
                    tables = [
                        table
                        for name, table in ModelBase.metadata.tables.items()
                        if name != "city_features"
                    ]
                    await conn.run_sync(
                        lambda sync_conn: ModelBase.metadata.create_all(
                            sync_conn, tables=tables
                        )
                    )
                    await conn.execute(
                        text(
                            "CREATE TABLE IF NOT EXISTS city_features ("
                            " id TEXT PRIMARY KEY,"
                            " layer VARCHAR(80) NOT NULL,"
                            " properties JSON,"
                            " geom TEXT,"
                            " created_at DATETIME,"
                            " updated_at DATETIME)"
                        )
                    )
                    await conn.execute(
                        text(
                            "CREATE INDEX IF NOT EXISTS ix_city_features_layer"
                            " ON city_features (layer)"
                        )
                    )
                else:
                    await conn.run_sync(ModelBase.metadata.create_all)
                await _migrate_policy_columns(conn, sqlite=sqlite)
        logger.info("init_db: οι πίνακες ελέγχθηκαν/δημιουργήθηκαν.")
        return True
    except Exception as exc:  # noqa: BLE001 — startup must never fail
        logger.warning("init_db απέτυχε (μη κρίσιμο): %s", exc)
        return False
