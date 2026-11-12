<#
.SYNOPSIS
  POLICYLAB local development launcher (Windows / PowerShell 5.1+).

.DESCRIPTION
  1. Starts the PostGIS database via docker compose (core profile: db only).
  2. Waits until the db healthcheck reports healthy.
  3. Runs `alembic upgrade head` from the repo root (PYTHONPATH includes apps/api).
  4. Starts the FastAPI backend with uvicorn --reload.
  5. Optionally (switch -Web) starts `npm.cmd dev` for the Next.js frontend.

.PARAMETER NoWeb
  Skip the frontend dev server.

.PARAMETER SkipMigrate
  Skip `alembic upgrade head` (use when migrations are not available yet).

.EXAMPLE
  .\infrastructure\deployment\dev.ps1            # db + api
  .\infrastructure\deployment\dev.ps1 -Web       # db + api + web
  .\infrastructure\deployment\dev.ps1 -SkipMigrate
#>
[CmdletBinding()]
param(
    [switch]$Web,
    [switch]$SkipMigrate
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # infrastructure/deployment -> repo root
Set-Location $RepoRoot
Write-Host "POLICYLAB dev — repo root: $RepoRoot" -ForegroundColor Cyan

# --- 1. Database -----------------------------------------------------------
Write-Host "[1/4] Starting db (docker compose up -d db)..." -ForegroundColor Cyan
docker compose up -d db
if ($LASTEXITCODE -ne 0) {
    Write-Warning "docker compose failed — is Docker Desktop running? Falling back to a db-less run (API degrades gracefully)."
}

# --- 2. Wait for health ----------------------------------------------------
if ($LASTEXITCODE -eq 0) {
    Write-Host "[2/4] Waiting for db to become healthy..." -ForegroundColor Cyan
    $healthy = $false
    for ($i = 0; $i -lt 30; $i++) {
        $state = docker inspect -f '{{.State.Health.Status}}' policylab-db-1 2>$null
        if ($state -eq "healthy") { $healthy = $true; break }
        Start-Sleep -Seconds 2
    }
    if ($healthy) { Write-Host "  db healthy." -ForegroundColor Green }
    else { Write-Warning "  db not healthy after 60s — continuing anyway." }
} else {
    Write-Host "[2/4] Skipped (no docker)." -ForegroundColor DarkGray
}

# --- 3. Migrations ---------------------------------------------------------
if (-not $SkipMigrate) {
    Write-Host "[3/4] alembic upgrade head" -ForegroundColor Cyan
    # PYTHONPATH from repo root so `app.*` (apps/api) and `services.*` both import (contracts §1).
    $env:PYTHONPATH = "$RepoRoot;$RepoRoot\apps/api"
    if (Get-Command alembic -ErrorAction SilentlyContinue) {
        alembic upgrade head
        if ($LASTEXITCODE -ne 0) { Write-Warning "alembic failed — API can still start if the schema exists." }
    } else {
        Write-Warning "alembic not on PATH — run: python -m alembic upgrade head"
        python -m alembic upgrade head
    }
} else {
    Write-Host "[3/4] Migration skipped (-SkipMigrate)." -ForegroundColor DarkGray
}

# --- 4. Backend ------------------------------------------------------------
Write-Host "[4/4] uvicorn (http://localhost:8000/docs)" -ForegroundColor Cyan
# Verified uvicorn flags: --app-dir (prepend import path), --reload (dev auto-reload),
# --host, --port. Equivalent to: uvicorn app.main:app --reload --app-dir apps/api
$env:PYTHONPATH = "$RepoRoot;$RepoRoot\apps/api"
$apiArgs = @("app.main:app", "--app-dir", "apps/api", "--reload", "--host", "127.0.0.1", "--port", "8000")

if ($Web) {
    # Run api and web concurrently; Ctrl+C stops both.
    $apiJob = Start-Job -ScriptBlock {
        param($root, $py, $args)
        Set-Location $root
        & python -m uvicorn @args
    } -ArgumentList $RepoRoot, "python", $apiArgs

    Push-Location $RepoRoot
    try {
        npm.cmd install
        npm.cmd dev
    } finally {
        Pop-Location
        Stop-Job $apiJob -ErrorAction SilentlyContinue
        Remove-Job $apiJob -Force -ErrorAction SilentlyContinue
    }
} else {
    & python -m uvicorn @apiArgs
}
