"""Dependency-free operational metrics (Phase 0).

`create_metrics_middleware()` counts requests and measures latency in memory;
`render_metrics()` emits Prometheus-compatible plain text from `GET /metrics`.
No new dependencies, no background threads.
"""
from __future__ import annotations

import time
from collections import Counter
from typing import Any

from fastapi import Request

_EXEMPT = {"/metrics", "/favicon.ico"}
_STATUS_BUCKETS = (100, 200, 300, 400, 500)


class Metrics:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.started_at = time.time()
        self.requests_total = 0
        self.inflight = 0
        self.duration_sum = 0.0
        self.duration_count = 0
        self.by_status: Counter[int] = Counter()
        self.by_path: Counter[str] = Counter()
        self.errors_total = 0

    def observe(self, path: str, status: int, duration: float) -> None:
        self.requests_total += 1
        self.duration_sum += duration
        self.duration_count += 1
        self.by_status[int(status)] += 1
        self.by_path[_normalise(path)] += 1
        if int(status) >= 500:
            self.errors_total += 1


def _normalise(path: str) -> str:
    """Collapse identifier segments so cardinality stays bounded."""
    parts = [part for part in path.split("/") if part]
    collapsed: list[str] = []
    for part in parts:
        if len(part) >= 24 or part.isdigit():
            collapsed.append("{id}")
        else:
            collapsed.append(part)
    return "/" + "/".join(collapsed)


metrics = Metrics()


def create_metrics_middleware():  # noqa: ANN201 — returns an ASGI dispatch callable
    async def dispatch(request: Request, call_next):  # noqa: ANN001, ANN202
        path = request.url.path
        if path in _EXEMPT:
            return await call_next(request)
        metrics.inflight += 1
        started = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
        except Exception:
            status = 500
            raise
        finally:
            metrics.inflight -= 1
            metrics.observe(path, status, time.perf_counter() - started)
        return response

    return dispatch


def _connector_states() -> dict[str, str]:
    try:
        from app.repositories import sources as sources_repo

        return {
            str(name): str(state.get("status") or "unknown")
            for name, state in sources_repo.health_map().items()
        }
    except Exception:  # noqa: BLE001
        return {}


def render_metrics() -> str:
    lines: list[str] = [
        "# HELP policylab_up Always 1 while the API process is serving.",
        "# TYPE policylab_up gauge",
        "policylab_up 1",
        "# HELP policylab_uptime_seconds Seconds since process start.",
        "# TYPE policylab_uptime_seconds gauge",
        f"policylab_uptime_seconds {time.time() - metrics.started_at:.3f}",
        "# HELP policylab_requests_total Total HTTP requests observed.",
        "# TYPE policylab_requests_total counter",
        f"policylab_requests_total {metrics.requests_total}",
        "# HELP policylab_requests_inflight Requests currently in flight.",
        "# TYPE policylab_requests_inflight gauge",
        f"policylab_requests_inflight {metrics.inflight}",
        "# HELP policylab_request_duration_seconds Request latency.",
        "# TYPE policylab_request_duration_seconds summary",
        f"policylab_request_duration_seconds_sum {metrics.duration_sum:.6f}",
        f"policylab_request_duration_seconds_count {metrics.duration_count}",
        "# HELP policylab_requests_by_status Requests grouped by status class.",
        "# TYPE policylab_requests_by_status counter",
    ]
    for bucket in _STATUS_BUCKETS:
        count = sum(
            value for status, value in metrics.by_status.items() if bucket <= status < bucket + 100
        )
        lines.append(f'policylab_requests_by_status{{class="{bucket}"}} {count}')
    lines.extend(
        [
            "# HELP policylab_errors_total Responses with a 5xx status.",
            "# TYPE policylab_errors_total counter",
            f"policylab_errors_total {metrics.errors_total}",
        ]
    )
    if metrics.by_path:
        lines.extend(
            [
                "# HELP policylab_requests_by_path Requests grouped by route pattern.",
                "# TYPE policylab_requests_by_path counter",
            ]
        )
        for path, count in sorted(metrics.by_path.items()):
            lines.append(f'policylab_requests_by_path{{path="{path}"}} {count}')
    states = _connector_states()
    if states:
        lines.extend(
            [
                "# HELP policylab_connector_up Last-known connector health (1 up, 0 down).",
                "# TYPE policylab_connector_up gauge",
            ]
        )
        for name, state in sorted(states.items()):
            up = 0 if state in {"down", "disabled"} else 1
            lines.append(f'policylab_connector_up{{name="{name}",status="{state}"}} {up}')
    return "\n".join(lines) + "\n"


def snapshot() -> dict[str, Any]:
    """Machine-readable counters (used by tests and the smoke script)."""
    return {
        "requests_total": metrics.requests_total,
        "errors_total": metrics.errors_total,
        "duration_count": metrics.duration_count,
        "duration_sum": round(metrics.duration_sum, 6),
        "by_status": dict(metrics.by_status),
        "by_path": dict(metrics.by_path),
    }
