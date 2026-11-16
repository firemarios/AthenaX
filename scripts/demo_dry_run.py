"""Timed Day-4 rehearsal of the flagship journey.

Starts a local API if one is not already listening, runs the E2E smoke script
with per-step timings, and writes docs/_internal/evidence/dry-run.md plus the raw log.

Run: python scripts/demo_dry_run.py
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8000"
SMOKE = ROOT / "infrastructure" / "deployment" / "smoke.ps1"
OUTPUT = ROOT / "docs" / "_internal" / "evidence" / "dry-run.md"
LOG = ROOT / "docs" / "_internal" / "evidence" / "dry-run-smoke.log"
TEMP = Path.home() / "AppData" / "Local" / "Temp" / "opencode"
API_OUT = TEMP / "dry-run-api-out.log"
API_ERR = TEMP / "dry-run-api-err.log"


def healthy(timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(f"{BASE}/health", timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return bool(payload.get("data"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return False


def start_api(reuse: bool) -> tuple[subprocess.Popen | None, bool]:
    if healthy():
        if reuse:
            print("Using the API already listening on 127.0.0.1:8000 (--reuse)")
            return None, True
        print("An API is already listening on 127.0.0.1:8000.")
        print("Stop it first, or pass --reuse to rehearse against it.")
        return None, False
    TEMP.mkdir(parents=True, exist_ok=True)
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
            "8000",
        ],
        cwd=str(ROOT),
        stdout=out,
        stderr=err,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            break
        if healthy():
            print(f"API started (PID {process.pid})")
            return process, True
        time.sleep(1.5)
    print("API did not become healthy; see", API_ERR)
    stop_api(process)
    return None, False


def stop_api(process: subprocess.Popen | None) -> None:
    if process is None:
        return
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
        print("API stopped")


def parse(output: str) -> tuple[list[tuple[str, float]], float]:
    steps: list[tuple[str, float]] = []
    pattern = re.compile(r"^\s{2}(.+?)\s{2,}(\d+(?:[.,]\d+)?)s\s*$")
    for line in output.splitlines():
        match = pattern.match(line)
        if match:
            steps.append((match.group(1).strip(), float(match.group(2).replace(",", "."))))
    total = 0.0
    header = re.search(r"Step timings \(total (\d+(?:[.,]\d+)?)s\)", output)
    if header:
        total = float(header.group(1).replace(",", "."))
    return steps, round(total or sum(value for _, value in steps), 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Timed Day-4 dry run of the flagship journey.")
    parser.add_argument("--reuse", action="store_true", help="reuse an API already on :8000")
    parser.add_argument(
        "--skip-live-ingest",
        action="store_true",
        help="pass -SkipLiveIngest to smoke (pre-warmed city_features)",
    )
    args = parser.parse_args()

    process, ready = start_api(args.reuse)
    if not ready:
        return 2
    if process is None and not healthy():
        print("No API available; cannot run the rehearsal.")
        return 1

    smoke_command = [
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SMOKE),
        "-BaseUrl",
        BASE,
    ]
    if args.skip_live_ingest:
        smoke_command.append("-SkipLiveIngest")

    started = time.monotonic()
    try:
        completed = subprocess.run(
            smoke_command,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=900,
        )
    finally:
        stop_api(process)

    wall = round(time.monotonic() - started, 1)
    output = completed.stdout + "\n" + completed.stderr
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(output, encoding="utf-8")

    verdict = re.search(r"SMOKE (PASSED|FAILED).*", output)
    verdict_line = verdict.group(0).strip() if verdict else "SMOKE result not found"
    checks = re.search(r"\((\d+) checks\)", output)
    steps, journey = parse(output)
    ai_step = next((value for name, value in steps if "Ask the City" in name), None)
    ai_text = f"{ai_step}s" if ai_step is not None else "n/a"
    command = f"powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 -BaseUrl {BASE}"
    if args.skip_live_ingest:
        command += " -SkipLiveIngest"
    ingest_text = (
        "skipped (pre-warmed `city_features`; live Overpass unavailable)"
        if args.skip_live_ingest
        else "live"
    )
    now = datetime.now(timezone.utc).isoformat()

    lines = [
        "# Timed dry run - flagship journey",
        "",
        f"- Generated: **{now}**",
        f"- Command: `{command}`",
        f"- Result: **{verdict_line}**",
        f"- Checks: **{checks.group(1) if checks else 'n/a'}**",
        f"- Ingest: **{ingest_text}**",
        f"- API journey time (sum of steps): **{journey}s**",
        f"- Wall time including API cold start and teardown: **{wall}s**",
        f"- AI step: **{ai_text}**",
        f"- 5-minute demo budget: **300s** (headroom **{round(300 - journey, 1)}s**)",
        "",
        "## Measured steps",
        "",
        "| Step | Measured |",
        "|---|---|",
    ]
    for name, value in steps:
        lines.append(f"| {name} | {value}s |")
    lines.extend(
        [
            "",
            "## Reading it",
            "",
            "The 5-minute demo script budgets 300 s. The measured API journey above is the",
            "machine time; the remainder is narration and UI transitions. The AI step is the",
            "only variable cost and it has a 180 s client timeout in the smoke script.",
        ]
    )
    if ai_step is not None and ai_step >= 60:
        lines.extend(
            [
                "",
                "## Rehearsal finding: live AI is slow",
                "",
                f"The AI step took **{ai_step}s**. That is too long to wait in silence on stage.",
                "Mitigation for the live demo:",
                "",
                "1. Pre-warm `/ask` (send the question before the audience joins) and narrate the",
                "   evidence panel from the loaded answer.",
                "2. Or ask the question at 0:00 and keep talking through `/data` while it runs.",
                "3. Keep the documented fallback: if the LLM is unreachable, the API returns an",
                "   explicit `llm unavailable` limitation and the simulation path still works",
                "   (proven in [`fallback-check.md`](fallback-check.md)).",
            ]
        )
    if args.skip_live_ingest:
        lines.extend(
            [
                "",
                "Live ingest was skipped because the public Overpass mirrors were timing out;",
                "the snapshot still came from the previously ingested `city_features`, which is",
                "exactly the pre-warmed demo path in `docs/DEMO.md`.",
            ]
        )
    lines.extend(
        [
            "",
            "Raw output: [`dry-run-smoke.log`](dry-run-smoke.log).",
            "",
            "## Freeze rule",
            "",
            "If this document is stale after a code change, re-run",
            "`python scripts/demo_dry_run.py --skip-live-ingest` before using it as evidence.",
        ]
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{verdict_line}; journey {journey}s (AI {ai_text}); wrote {OUTPUT}")
    return 0 if completed.returncode == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
