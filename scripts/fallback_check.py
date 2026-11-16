"""Day-4 hardening: prove the local demo survives a dead LLM and no live data.

Starts a second API on :8011 with an unreachable LLM endpoint and
ATHENAX_SNAPSHOT_LIVE=0, then checks that:
  * /v1/ai/query still returns a valid envelope with explicit limitations;
  * a greenspace simulation still succeeds with a snapshot/passport.

Writes docs/evidence/fallback-check.md.
Run: python scripts/fallback_check.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8011"
OUTPUT = ROOT / "docs" / "evidence" / "fallback-check.md"
TEMP = Path.home() / "AppData" / "Local" / "Temp" / "opencode"
API_OUT = TEMP / "fallback-api-out.log"
API_ERR = TEMP / "fallback-api-err.log"


def request_json(method: str, path: str, body: dict | None = None, timeout: float = 120.0):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def healthy(timeout: float = 2.0) -> bool:
    try:
        status, payload = request_json("GET", "/health", timeout=timeout)
        return status == 200 and bool(payload.get("data"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return False


def start_api() -> subprocess.Popen | None:
    if healthy():
        print(f"An API is already listening on {BASE}; stop it first.")
        return None
    TEMP.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.update(
        {
            "ATHENAX_LLM_PROVIDER": "openai_compatible",
            "ATHENAX_LLM_BASE_URL": "http://127.0.0.1:1/v1",
            "ATHENAX_LLM_API_KEY": "offline-check",
            "ATHENAX_LLM_MODEL": "offline-check",
            "ATHENAX_SNAPSHOT_LIVE": "0",
        }
    )
    out = API_OUT.open("w", encoding="utf-8")
    err = API_ERR.open("w", encoding="utf-8")
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "apps/api",
            "--host",
            "127.0.0.1",
            "--port",
            "8011",
        ],
        cwd=str(ROOT),
        env=env,
        stdout=out,
        stderr=err,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            break
        if healthy():
            return process
        time.sleep(1.5)
    print("API did not become healthy; see", API_ERR)
    stop_api(process)
    return None


def stop_api(process: subprocess.Popen) -> None:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                capture_output=True,
                check=False,
            )


def main() -> int:
    process = start_api()
    if process is None:
        return 1
    started = time.monotonic()
    try:
        health_status, health = request_json("GET", "/health", timeout=20)
        ask_status, ask = request_json(
            "POST",
            "/v1/ai/query",
            {
                "question": "Ποια ανοιχτά δεδομένα υπάρχουν για τα πάρκα στην Αθήνα;",
                "city": "Athens",
            },
        )
        sim_status, sim = request_json(
            "POST",
            "/v1/simulations",
            {
                "model": "greenspace",
                "area": "exarchia",
                "seed": 42,
                "compare_baseline": True,
                "parameters": {
                    "park_count": 10,
                    "avg_park_m2": 6000,
                    "population": 10000,
                },
            },
        )
    finally:
        stop_api(process)
    wall = round(time.monotonic() - started, 1)

    ask_data = ask.get("data") or {}
    sim_data = sim.get("data") or {}
    summary = str(ask_data.get("summary") or "")
    limitations = list(ask_data.get("limitations") or [])
    sources = list(ask_data.get("sources") or [])
    snapshot = ((sim_data.get("results") or {}).get("snapshot") or {})
    snapshot_mode = snapshot.get("mode") or sim_data.get("snapshot_mode")
    checksum = (sim_data.get("passport") or {}).get("inputs_checksum") or ""
    health_llm = (health.get("data") or {}).get("llm")

    ai_ok = (
        ask_status == 200
        and ask.get("ok") is True
        and bool(summary)
        and bool(limitations)
    )
    sim_ok = (
        sim_status == 200
        and sim.get("ok") is True
        and sim_data.get("status") == "succeeded"
        and snapshot_mode in {"snapshot", "synthetic"}
        and len(checksum) == 64
    )
    passed = ai_ok and sim_ok

    lines = [
        "# Offline fallback check - dead LLM, no live Overpass",
        "",
        f"- Generated: **{datetime.now(timezone.utc).isoformat()}**",
        "- API: `:8011` with `ATHENAX_LLM_BASE_URL=http://127.0.0.1:1/v1` and",
        "  `ATHENAX_SNAPSHOT_LIVE=0`.",
        f"- Wall time: **{wall}s**",
        f"- `/health`: HTTP {health_status}, `llm={health_llm}`",
        "",
        "## AI answer without an LLM",
        "",
        f"- HTTP {ask_status}, `ok={ask.get('ok')}`",
        f"- summary: `{summary[:200]}`",
        f"- limitations: `{limitations}`",
        f"- sources: **{len(sources)}**",
        f"- Result: **{'PASS' if ai_ok else 'FAIL'}** (valid envelope + explicit limitation, no 500)",
        "",
        "## Simulation without live data",
        "",
        f"- HTTP {sim_status}, `status={sim_data.get('status')}`",
        f"- snapshot mode: **{snapshot_mode}**",
        f"- passport checksum: `{checksum[:16]}…`",
        f"- Result: **{'PASS' if sim_ok else 'FAIL'}** (deterministic run still works offline)",
        "",
        f"## Verdict: **{'PASS' if passed else 'FAIL'}**",
        "",
        "This is the documented demo fallback: the AI layer degrades explicitly while the",
        "snapshot and simulation path keeps working.",
        "",
        "Reproduce: `python scripts/fallback_check.py`",
    ]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        f"AI {'ok' if ai_ok else 'FAIL'} (llm={health_llm}, limitations={limitations}); "
        f"simulation {'ok' if sim_ok else 'FAIL'} (mode={snapshot_mode}); wrote {OUTPUT}"
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
