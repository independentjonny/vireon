param(
  [string]$AppUrl = "http://localhost:3000",
  [string]$SupervisorUrl = "http://localhost:4010",
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Continue"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$EvidenceDir = Join-Path $Root ".ai-supervisor"
$LockPath = Join-Path $EvidenceDir "validation.lock.json"

function Write-Diagnostic {
  param([string]$Message)
  Write-Output "[neven:diagnose] $Message"
}

function Test-UrlStatus {
  param([string]$Url)
  try {
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return "ok status=$($Response.StatusCode)"
  } catch {
    return "failed $($_.Exception.Message -replace "\s+", " ")"
  }
}

function Get-JsonStatus {
  param([string]$Url)
  try {
    return Invoke-RestMethod -Uri $Url -Method Post -TimeoutSec 5
  } catch {
    return $null
  }
}

function Get-PortOwners {
  param([int[]]$Ports)
  $Connections = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue
  if ($null -eq $Connections) {
    return @()
  }
  return @($Connections | Select-Object LocalPort, OwningProcess)
}

function Invoke-QuickBrowserCheck {
  $TempRoot = [System.IO.Path]::GetTempPath()
  $ScriptPath = Join-Path $TempRoot "neven-diagnose-browser.cjs"
  $OutPath = Join-Path $TempRoot "neven-diagnose-browser.out.json"
  $ErrPath = Join-Path $TempRoot "neven-diagnose-browser.err.log"
  $Script = @'
const { chromium } = require("playwright");
const url = process.argv[2];
const issues = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push(`console error: ${msg.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) issues.push(`http ${response.status()}: ${response.url()}`);
  });
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  await browser.close();
  process.stdout.write(JSON.stringify({ ok: issues.length === 0, issues: [...new Set(issues)] }));
})().catch((error) => {
  process.stdout.write(JSON.stringify({ ok: false, issues: [String(error && error.message ? error.message : error).split(/\r?\n/)[0]] }));
});
'@

  [System.IO.File]::WriteAllText($ScriptPath, $Script)
  Remove-Item -LiteralPath $OutPath, $ErrPath -Force -ErrorAction SilentlyContinue
  $Process = Start-Process -FilePath "node" `
    -WindowStyle Hidden `
    -WorkingDirectory $Root `
    -ArgumentList @($ScriptPath, $AppUrl) `
    -RedirectStandardOutput $OutPath `
    -RedirectStandardError $ErrPath `
    -PassThru

  if (-not $Process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    return "failed timeout after ${TimeoutSeconds}s"
  }

  $Output = if (Test-Path $OutPath) { Get-Content -Raw $OutPath } else { "" }
  if ([string]::IsNullOrWhiteSpace($Output)) {
    $ErrorText = if (Test-Path $ErrPath) { (Get-Content -Raw $ErrPath) -replace "\s+", " " } else { "no output" }
    return "failed $ErrorText"
  }
  return $Output
}

Write-Diagnostic "root=$Root"
Write-Diagnostic "app=$AppUrl $(Test-UrlStatus $AppUrl)"
Write-Diagnostic "supervisor-health=$SupervisorUrl/health $(Test-UrlStatus "$SupervisorUrl/health")"

$Ports = Get-PortOwners -Ports @(3000, 4010)
Write-Diagnostic "ports=$(if ($Ports.Count -gt 0) { $Ports | ConvertTo-Json -Compress } else { "[]" })"

if (Test-Path $LockPath) {
  try {
    $Lock = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
    $OwnerAlive = $false
    if ([int]$Lock.ownerPid -gt 0) {
      $OwnerAlive = $null -ne (Get-Process -Id ([int]$Lock.ownerPid) -ErrorAction SilentlyContinue)
    }
    Write-Diagnostic "active-lock runId=$($Lock.runId) ownerPid=$($Lock.ownerPid) ownerAlive=$OwnerAlive createdAt=$($Lock.createdAt)"
  } catch {
    Write-Diagnostic "active-lock malformed $($_.Exception.Message)"
  }
} else {
  Write-Diagnostic "active-lock none"
}

$Status = Get-JsonStatus "$SupervisorUrl/status"
if ($null -eq $Status) {
  Write-Diagnostic "supervisor-status unavailable"
} else {
  Write-Diagnostic "supervisor-status state=$($Status.state.status) activeTaskId=$($Status.activeTaskId) queue=$($Status.queueLength) processing=$($Status.processing) lastError=$($Status.lastError)"
  $LatestTask = @($Status.tasks | Sort-Object updatedAt -Descending | Select-Object -First 1)
  if ($LatestTask.Count -gt 0) {
    Write-Diagnostic "last-task id=$($LatestTask[0].id) status=$($LatestTask[0].status) updatedAt=$($LatestTask[0].updatedAt) issue=$($LatestTask[0].lastIssue)"
  }
  $Now = Get-Date
  $StaleRunning = @($Status.tasks | Where-Object {
    $_.status -eq "running" -and $_.startedAt -and (($Now - ([datetime]$_.startedAt)).TotalMinutes -gt 5)
  })
  Write-Diagnostic "stale-running-tasks=$($StaleRunning.Count) ids=$($StaleRunning.id -join ",")"
}

Write-Diagnostic "browser-health=$(Invoke-QuickBrowserCheck)"
$LogPath = Join-Path $EvidenceDir "actions.log"
if (Test-Path $LogPath) {
  Write-Diagnostic "recent-log=$((Get-Content -LiteralPath $LogPath -Tail 8) -join " || ")"
} else {
  Write-Diagnostic "recent-log none"
}
Write-Diagnostic "recommended-action=Run npm run neven after clearing any reported browser or stale-task issue."
