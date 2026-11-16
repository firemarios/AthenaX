#requires -version 5.1
<#
.SYNOPSIS
  End-to-end smoke test for AthenaX (Phase 0).

.DESCRIPTION
  One command exercises the flagship journey against a running API:
  health -> ingest -> ask -> policy -> simulate -> passport -> impact -> export.
  Every step asserts the envelope contract and exits non-zero on failure.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1
  powershell -ExecutionPolicy Bypass -File infrastructure/deployment/smoke.ps1 -BaseUrl http://127.0.0.1:8000
#>
param(
  [string]$BaseUrl = "http://127.0.0.1:8000",
  [string]$Area = "exarchia",
  [switch]$SkipLiveIngest
)

$ErrorActionPreference = "Stop"
$script:Failures = 0
$script:Checks = 0
$script:Timings = [ordered]@{}
$script:CurrentStep = $null
$script:StepWatch = $null

function Write-Step([string]$Message) {
  if ($script:CurrentStep) {
    $elapsed = [math]::Round($script:StepWatch.Elapsed.TotalSeconds, 1)
    $script:Timings[$script:CurrentStep] = $elapsed
    Write-Host ("    ({0:N1}s)" -f $elapsed) -ForegroundColor DarkGray
  }
  $script:CurrentStep = $Message
  $script:StepWatch = [System.Diagnostics.Stopwatch]::StartNew()
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-True([bool]$Condition, [string]$Message) {
  $script:Checks++
  if ($Condition) {
    Write-Host "  [ok] $Message" -ForegroundColor Green
  } else {
    $script:Failures++
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
  }
}

function Invoke-Json([string]$Method, [string]$Path, $Body = $null, [int]$TimeoutSec = 60) {
  $uri = "$BaseUrl$Path"
  $params = @{ Method = $Method; Uri = $uri; Headers = @{ Accept = "application/json" }; TimeoutSec = $TimeoutSec }
  if ($null -ne $Body) {
    $params["ContentType"] = "application/json; charset=utf-8"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 12)
  }
  return Invoke-RestMethod @params
}

try {
  Write-Step "Health"
  $health = Invoke-Json "GET" "/health"
  Assert-True ($null -ne $health.data) "GET /health returns an envelope"
  Assert-True ($health.data.status -in @("ok", "degraded")) "health status is ok/degraded"

  Write-Step "Connector health (one live source)"
  $connectors = Invoke-Json "GET" "/v1/admin/connectors"
  Assert-True ($connectors.data.Count -ge 9) "at least 9 connectors are registered"

  if (-not $SkipLiveIngest) {
    Write-Step "Ingest (overpass -> datasets + city_features)"
    $ingest = Invoke-Json "POST" "/v1/admin/ingest" @{ source = "overpass" }
    Assert-True ($ingest.ok -eq $true) "ingest returns ok:true"
    Write-Host ("  ingested={0} skipped={1} errors={2}" -f $ingest.data.ingested, $ingest.data.skipped, $ingest.data.errors)
  }

  Write-Step "Ask the City"
  $ask = Invoke-Json "POST" "/v1/ai/query" @{ question = "Πόσοι κάτοικοι ζουν στα Εξάρχεια και ποιοι είναι οι βασικοί κίνδυνοι;"; city = "Athens" } -TimeoutSec 180
  Assert-True ($ask.ok -eq $true) "AI returns ok:true"
  Assert-True ($null -ne $ask.data.summary) "AI answer has a summary"
  Assert-True ($null -ne $ask.data.limitations) "AI answer always exposes limitations[]"

  Write-Step "Create policy"
  $policy = Invoke-Json "POST" "/v1/policies" @{
    title            = "Πιλοτικό πρόγραμμα πρασίνου"
    description      = "Αύξηση διαθέσιμου πρασίνου στα Εξάρχεια"
    category         = "environment"
    area             = $Area
    horizon          = "12 μήνες"
    budget_eur       = 250000
    factors          = @(@{ name = "park_count"; baseline = 6; min = 0; max = 30; unit = "parks" })
  }
  Assert-True ($null -ne $policy.data.id) "policy created with an id"

  Write-Step "Simulate (greenspace, snapshot inputs)"
  $sim = Invoke-Json "POST" "/v1/simulations" @{
    policy_id        = $policy.data.id
    model            = "greenspace"
    area             = $Area
    compare_baseline = $true
    seed             = 42
    parameters       = @{ park_count = 10; avg_park_m2 = 6000; population = 10000 }
  }
  $run = $sim.data
  Assert-True ($run.status -eq "succeeded") "simulation succeeded"
  Assert-True ($null -ne $run.passport) "simulation has a passport"
  Assert-True ($run.passport.inputs_checksum.Length -eq 64) "passport carries a sha256 inputs checksum"
  Assert-True ($null -ne $run.results.snapshot) "run records the pseudo-data snapshot metadata"
  if ($run.results.snapshot) {
    Write-Host ("  snapshot mode={0} coverage={1}" -f $run.results.snapshot.mode, ($run.results.snapshot.coverage | ConvertTo-Json -Compress))
    Assert-True ($run.results.snapshot.sources.Count -ge 1) "snapshot lists at least one source"
    $hasUrl = @($run.results.snapshot.sources | Where-Object { $_.url }).Count -ge 1
    if ($run.results.snapshot.mode -eq "snapshot") {
      Assert-True $hasUrl "snapshot mode carries a real source URL"
    }
  }

  Write-Step "Simulation detail"
  $detail = Invoke-Json "GET" "/v1/simulations/$($run.id)"
  Assert-True ($detail.data.id -eq $run.id) "run is persisted and retrievable"

  Write-Step "Reproduce with the same seed"
  $repro = Invoke-Json "POST" "/v1/simulations" @{
    model            = "greenspace"
    area             = $Area
    compare_baseline = $true
    seed             = $run.seed
    parameters       = $run.parameters
  }
  Assert-True ($repro.data.passport.inputs_checksum -eq $run.passport.inputs_checksum) "reproduce keeps the same inputs checksum"
  Assert-True (($repro.data.results.metrics | ConvertTo-Json -Compress) -eq ($run.results.metrics | ConvertTo-Json -Compress)) "reproduce returns identical metrics"

  Write-Step "Impact report"
  $impact = Invoke-Json "GET" "/v1/impact/$($run.id)"
  Assert-True ($impact.data.dimensions.Count -eq 6) "impact report has 6 dimensions"
  Assert-True ($null -ne $impact.data.reach) "impact report has a reach block"

  Write-Step "Research export"
  $project = Invoke-Json "POST" "/v1/research/projects" @{
    name        = "Smoke run $([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))"
    description = "Automated smoke test export"
  }
  $export = Invoke-WebRequest -Method GET -Uri "$BaseUrl/v1/research/projects/$($project.data.id)/export?format=md" -UseBasicParsing -TimeoutSec 60
  Assert-True ($export.StatusCode -eq 200) "research export returns 200"
  Assert-True ($export.Content.Length -gt 0) "research export is non-empty"

  Write-Step "Metrics endpoint"
  $metrics = Invoke-WebRequest -Method GET -Uri "$BaseUrl/metrics" -UseBasicParsing -TimeoutSec 30
  Assert-True ($metrics.Content -match "athenax_requests_total") "GET /metrics exposes Prometheus counters"
}
catch {
  $script:Failures++
  Write-Host ""
  Write-Host "SMOKE ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  if ($script:CurrentStep) {
    $elapsed = [math]::Round($script:StepWatch.Elapsed.TotalSeconds, 1)
    $script:Timings[$script:CurrentStep] = $elapsed
    Write-Host ("    ({0:N1}s)" -f $elapsed) -ForegroundColor DarkGray
  }
  Write-Host ""
  $totalSeconds = 0.0
  foreach ($value in $script:Timings.Values) { $totalSeconds += [double]$value }
  Write-Host ("Step timings (total {0:N1}s):" -f $totalSeconds) -ForegroundColor DarkGray
  foreach ($key in $script:Timings.Keys) {
    Write-Host ("  {0,-48} {1,7:N1}s" -f $key, $script:Timings[$key]) -ForegroundColor DarkGray
  }
  Write-Host ""
  if ($script:Failures -eq 0) {
    Write-Host "SMOKE PASSED ($($script:Checks) checks)" -ForegroundColor Green
    exit 0
  }
  Write-Host "SMOKE FAILED ($($script:Failures) failed / $($script:Checks) checks)" -ForegroundColor Red
  exit 1
}
