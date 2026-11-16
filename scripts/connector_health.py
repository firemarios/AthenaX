"""Connector health report (Phase 0, A).

Runs every registered connector's `health()` check and writes
`docs/_internal/evidence/connector-health.md` with status, latency and timestamp.

Usage:
    python scripts/connector_health.py
    python scripts/connector_health.py --output docs/_internal/evidence/connector-health.md
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:  # Windows consoles default to cp1252; the report is UTF-8.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

from services.connector_kit.catalog import CONNECTOR_CLASSES  # noqa: E402


def _catalog() -> dict[str, dict]:
    try:
        import yaml

        raw = (ROOT / "data" / "source-registry" / "catalog.yaml").read_text(encoding="utf-8")
        data = yaml.safe_load(raw) or {}
        entries = data.get("sources") or []
        return {str(entry.get("name")): entry for entry in entries if isinstance(entry, dict)}
    except Exception:  # noqa: BLE001
        return {}


async def _check_one(name: str, cls: type, entry: dict) -> dict:
    connector = cls(
        endpoint_url=str(entry.get("endpoint_url") or ""),
        enabled=bool(entry.get("enabled", True)),
        config=entry.get("config") or {},
    )
    started = datetime.now(timezone.utc)
    try:
        health = await connector.health()
    except Exception as exc:  # noqa: BLE001
        health = {"status": "down", "latency_ms": None, "detail": str(exc)[:200]}
    return {
        "name": name,
        "kind": getattr(connector, "kind", ""),
        "source_url": getattr(connector, "source_url", ""),
        "license": entry.get("license", ""),
        "status": health.get("status", "unknown"),
        "latency_ms": health.get("latency_ms"),
        "detail": health.get("detail", ""),
        "checked_at": health.get("checked_at") or started.isoformat(),
    }


def _markdown(rows: list[dict], started_at: str) -> str:
    healthy = sum(1 for row in rows if row["status"] == "healthy")
    degraded = sum(1 for row in rows if row["status"] == "degraded")
    down = sum(1 for row in rows if row["status"] == "down")
    lines = [
        "# Connector health report",
        "",
        f"- Generated: **{started_at}**",
        f"- Sources checked: **{len(rows)}**",
        f"- Healthy: **{healthy}** · Degraded: **{degraded}** · Down: **{down}**",
        "- Method: one HTTPS `GET` per source endpoint, 10 s timeout (`BaseConnector.health`).",
        "- Note: a `healthy` HTTP status only proves reachability; it does not guarantee a usable JSON API.",
        "",
        "| # | Source | Kind | Status | Latency | Detail | License | Checked at |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for index, row in enumerate(sorted(rows, key=lambda item: item["name"]), start=1):
        latency = f'{row["latency_ms"]} ms' if row["latency_ms"] is not None else "—"
        detail = str(row["detail"] or "").replace("|", "\\|")
        lines.append(
            f'| {index} | `{row["name"]}` | {row["kind"]} | **{row["status"]}** | {latency} | '
            f"{detail} | {row['license'] or '—'} | {row['checked_at']} |"
        )
    lines.extend(
        [
            "",
            "## Known limitations (honest degradation)",
            "",
            "- **ELSTAT** exposes no public JSON search API. The connector returns curated, official",
            "  publication pages (real URLs) rather than invented records; `healthy` here means the",
            "  portal is reachable, not that a machine API exists.",
            "- **ΚΗΜΔΗΣ** is best-effort JSON. HTML or DNS failures degrade to `[]`; the platform",
            "  reports it as `down`/`degraded` instead of fabricating contracts.",
            "- **Eurostat** returns 404 on its bare root; the data endpoint needs dataset parameters,",
            "  so a `degraded` probe is expected and is not hidden.",
            "- **Overpass** rejects bare GETs (406); its health probe runs a tiny real query instead.",
            "",
            "## Reproduce",
            "",
            "```bash",
            "python scripts/connector_health.py",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


async def main() -> int:
    parser = argparse.ArgumentParser(description="Check every AthenaX connector and write a report.")
    parser.add_argument(
        "--output",
        default=str(ROOT / "docs" / "_internal" / "evidence" / "connector-health.md"),
        help="Markdown output path",
    )
    args = parser.parse_args()

    entries = _catalog()
    started_at = datetime.now(timezone.utc).isoformat()
    names = sorted(CONNECTOR_CLASSES)
    rows = await asyncio.gather(
        *(_check_one(name, CONNECTOR_CLASSES[name], entries.get(name, {})) for name in names)
    )

    report = _markdown(list(rows), started_at)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report, encoding="utf-8")
    print(report)
    print(f"\nWritten to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
