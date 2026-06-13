$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$AppUrl = "http://localhost:3000"
$SupervisorUrl = "http://localhost:4010"
$EvidenceDir = Join-Path $Root ".ai-supervisor"

function Test-Url {
  param([string]$Url)

  try {
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return ($Response.StatusCode -ge 200 -and $Response.StatusCode -le 399)
  } catch {
    return $false
  }
}

function Wait-Url {
  param(
    [string]$Url,
    [string]$Name,
    [int]$TimeoutSeconds = 120
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $Deadline) {
    if (Test-Url $Url) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "$Name did not become healthy."
}

function Invoke-SupervisorJson {
  param(
    [string]$Path,
    [object]$Body = $null
  )

  $Arguments = @{
    Uri = "$SupervisorUrl$Path"
    Method = "Post"
    ContentType = "application/json"
    TimeoutSec = 5
  }

  if ($null -ne $Body) {
    $Arguments.Body = ($Body | ConvertTo-Json -Compress -Depth 8)
  }

  Invoke-RestMethod @Arguments
}

function Wait-Task {
  param(
    [string]$TaskId,
    [int]$TimeoutSeconds = 900
  )

  $TerminalStatuses = @("complete", "failed", "stopped")
  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $Deadline) {
    $Status = Invoke-SupervisorJson -Path "/status"
    $Task = $Status.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1

    if ($null -ne $Task -and $TerminalStatuses -contains $Task.status) {
      if ($Task.status -eq "complete") {
        return
      }

      if ($Task.lastIssue) {
        throw "Supervisor task failed: $($Task.lastIssue)"
      }

      throw "Supervisor task ended with status $($Task.status)."
    }

    Start-Sleep -Seconds 2
  }

  throw "Supervisor task did not complete."
}

function Invoke-BrowserHealthCheck {
  param(
    [string]$Url,
    [string]$ScreenshotName
  )

  New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
  $ScreenshotPath = Join-Path $EvidenceDir $ScreenshotName
  $ScriptPath = Join-Path ([System.IO.Path]::GetTempPath()) "neven-browser-health.cjs"
  $BrowserScript = @'
const { chromium } = require("playwright");

const url = process.argv[2];
const screenshotPath = process.argv[3];
const issues = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      issues.push(`console error: ${msg.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    issues.push(`request failed: ${request.url()} ${failure ? failure.errorText : ""}`.trim());
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      issues.push(`http ${status}: ${response.url()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    issues.push(`browser check failed: ${error.message}`);
  } finally {
    await browser.close();
  }

  const uniqueIssues = [...new Set(issues)];
  process.stdout.write(JSON.stringify({
    ok: uniqueIssues.length === 0,
    issues: uniqueIssues,
    screenshotPath
  }));
})().catch((error) => {
  process.stdout.write(JSON.stringify({
    ok: false,
    issues: [`browser check failed: ${error.message}`],
    screenshotPath
  }));
});
'@

  [System.IO.File]::WriteAllText($ScriptPath, $BrowserScript)
  $Output = & node $ScriptPath $Url $ScreenshotPath 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Output)) {
    throw "Browser health check failed."
  }

  $Output | ConvertFrom-Json
}

function Submit-Task {
  param([string]$Goal)

  $SubmittedTask = Invoke-SupervisorJson -Path "/task" -Body @{
    goal = $Goal
    approved = $true
  }

  if ($null -eq $SubmittedTask.task -or [string]::IsNullOrWhiteSpace($SubmittedTask.task.id)) {
    throw "Supervisor did not accept the task."
  }

  Wait-Task -TaskId $SubmittedTask.task.id
}

try {
  if (-not (Test-Url $AppUrl)) {
    Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -WorkingDirectory $Root -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "npm run dev"
    ) | Out-Null
  }

  if (-not (Test-Url "$SupervisorUrl/health")) {
    Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -WorkingDirectory $Root -ArgumentList @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "`$env:NEVEN_SUPERVISOR_PORT='4010'; `$env:NEVEN_APP_URL='$AppUrl'; node --experimental-strip-types tools/neven-supervisor/supervisor.ts"
    ) | Out-Null
  }

  Wait-Url -Url $AppUrl -Name "App"
  Wait-Url -Url "$SupervisorUrl/health" -Name "Supervisor"

  $BrowserCheck = Invoke-BrowserHealthCheck -Url $AppUrl -ScreenshotName "browser-health-before.png"
  $LastTaskOk = $true

  if (-not $BrowserCheck.ok) {
    $IssueSummary = ($BrowserCheck.issues | Select-Object -First 8) -join "; "
    Submit-Task -Goal "Fix Neven browser health errors from automated Playwright check. Evidence: $($BrowserCheck.screenshotPath). Errors: $IssueSummary"
    $BrowserCheck = Invoke-BrowserHealthCheck -Url $AppUrl -ScreenshotName "browser-health-after.png"
    if (-not $BrowserCheck.ok) {
      $IssueSummary = ($BrowserCheck.issues | Select-Object -First 3) -join "; "
      throw "Browser health check failed: $IssueSummary"
    }
  }

  if (-not $LastTaskOk) {
    throw "Supervisor task failed."
  }

  Write-Output "APP=OK"
  Write-Output "SUPERVISOR=OK"
  Write-Output "BROWSER=OK"
  Write-Output "LAST_TASK=OK"
} catch {
  Write-Output ($_.Exception.Message -replace "\s+", " ")
  exit 1
}
