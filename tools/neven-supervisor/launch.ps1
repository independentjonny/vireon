param(
  [int]$TotalTimeoutSeconds = 180,
  [int]$AppTimeoutSeconds = 60,
  [int]$SupervisorTimeoutSeconds = 60,
  [int]$BrowserTimeoutSeconds = 75,
  [int]$TaskTimeoutSeconds = 120,
  [int]$LockStaleSeconds = 300,
  [switch]$KeepStartedProcesses,
  [switch]$RunRemediationProbe,
  [string]$ProbeIssue = "http 500: remediation probe"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$AppUrl = "http://localhost:3000"
$SupervisorUrl = "http://localhost:4010"
$EvidenceDir = Join-Path $Root ".ai-supervisor"
$ScriptStart = Get-Date
$GlobalDeadline = $ScriptStart.AddSeconds($TotalTimeoutSeconds)
$LastActiveStage = "initialise"
$LastActiveSubstage = "initialise"
$LatestSuccessfulCheckpoint = "none"
$RemediationAttempts = 0
$RunId = "neven-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$PID"
$LockPath = Join-Path $EvidenceDir "validation.lock.json"
$CleanupResult = "not-run"
$CleanupPerformed = $false
$StartedProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

function Write-NevenLog {
  param([string]$Message)
  Write-Output "[neven] $Message"
}

function Get-ElapsedSeconds {
  return [math]::Round(((Get-Date) - $ScriptStart).TotalSeconds, 1)
}

function Assert-TotalTimeout {
  if ((Get-Date) -gt $GlobalDeadline) {
    throw "Validation timed out after ${TotalTimeoutSeconds}s. Last active stage: $script:LastActiveStage. Last active substage: $script:LastActiveSubstage."
  }
}

function Set-ActiveSubstage {
  param([string]$Name)
  $script:LastActiveSubstage = $Name
  $Remaining = [math]::Max(0, [math]::Round(($GlobalDeadline - (Get-Date)).TotalSeconds, 1))
  Write-NevenLog "SUBSTAGE $script:LastActiveStage/$Name elapsed=$(Get-ElapsedSeconds)s remaining=${Remaining}s checkpoint=$script:LatestSuccessfulCheckpoint"
}

function Stop-StartedProcesses {
  $Stopped = 0
  foreach ($Process in $StartedProcesses) {
    if ($null -ne $Process -and -not $Process.HasExited) {
      Write-NevenLog "stopping child process pid=$($Process.Id)"
      try {
        Stop-ProcessTree -ProcessId $Process.Id
        $Process.WaitForExit(5000) | Out-Null
        $Stopped += 1
      } catch {
        Write-NevenLog "could not stop child process pid=$($Process.Id): $($_.Exception.Message)"
      }
    }
  }
  $script:CleanupResult = "stopped=$Stopped tracked=$($StartedProcesses.Count)"
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  $Children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId ([int]$Child.ProcessId)
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Invoke-Stage {
  param(
    [string]$Name,
    [int]$TimeoutSeconds,
    [scriptblock]$Script
  )

  Assert-TotalTimeout
  $script:LastActiveStage = $Name
  $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  Write-NevenLog "START $Name timeout=${TimeoutSeconds}s elapsed=$(Get-ElapsedSeconds)s"

  try {
    & $Script
    $Stopwatch.Stop()
    $script:LatestSuccessfulCheckpoint = $Name
    Write-NevenLog "OK $Name duration=$([math]::Round($Stopwatch.Elapsed.TotalSeconds, 1))s elapsed=$(Get-ElapsedSeconds)s"
  } catch {
    $Stopwatch.Stop()
    Write-NevenLog "FAIL $Name duration=$([math]::Round($Stopwatch.Elapsed.TotalSeconds, 1))s elapsed=$(Get-ElapsedSeconds)s"
    throw
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

function Get-RecentLogLines {
  param(
    [string]$Path,
    [int]$Count = 12
  )

  if (-not (Test-Path $Path)) {
    return @()
  }

  return @(Get-Content -LiteralPath $Path -Tail $Count -ErrorAction SilentlyContinue)
}

function Get-SupervisorStatus {
  try {
    return Invoke-SupervisorJson -Path "/status"
  } catch {
    return $null
  }
}

function Get-StaleRunningTasks {
  param([object]$Status)

  if ($null -eq $Status -or $null -eq $Status.tasks) {
    return @()
  }

  $Now = Get-Date
  return @($Status.tasks | Where-Object {
    $_.status -eq "running" -and
    $_.startedAt -and
    (($Now - ([datetime]$_.startedAt)).TotalSeconds -gt $LockStaleSeconds)
  })
}

function Acquire-ValidationLock {
  New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
  Set-ActiveSubstage "lock-acquire"

  function Write-NewValidationLock {
    $Payload = [ordered]@{
      runId = $RunId
      ownerPid = $PID
      createdAt = (Get-Date).ToString("o")
      root = $Root
      stage = $LastActiveStage
    }
    $Json = $Payload | ConvertTo-Json -Depth 4
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
    $Stream = [System.IO.File]::Open($LockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {
      $Stream.Write($Bytes, 0, $Bytes.Length)
    } finally {
      $Stream.Dispose()
    }
  }

  if (Test-Path $LockPath) {
    $Existing = $null
    try {
      $Existing = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
    } catch {
      Write-NevenLog "validation lock is malformed; replacing stale lock"
      Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue
    }

    if ($null -ne $Existing) {
      $OwnerPid = [int]$Existing.ownerPid
      $OwnerAlive = $false
      if ($OwnerPid -gt 0) {
        $OwnerAlive = $null -ne (Get-Process -Id $OwnerPid -ErrorAction SilentlyContinue)
      }
      $CreatedAt = if ($Existing.createdAt) { [datetime]$Existing.createdAt } else { (Get-Date).AddYears(-10) }
      $AgeSeconds = ((Get-Date) - $CreatedAt).TotalSeconds

      if ($OwnerAlive -and $AgeSeconds -lt $LockStaleSeconds) {
        throw "Another Neven validation owns the lock. runId=$($Existing.runId) ownerPid=$OwnerPid age=$([math]::Round($AgeSeconds, 1))s lock=$LockPath"
      }

      Write-NevenLog "replacing stale validation lock runId=$($Existing.runId) ownerPid=$OwnerPid age=$([math]::Round($AgeSeconds, 1))s ownerAlive=$OwnerAlive"
      Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue
    }
  }

  try {
    Write-NewValidationLock
  } catch {
    $Existing = if (Test-Path $LockPath) {
      try { Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json } catch { $null }
    } else {
      $null
    }
    if ($null -ne $Existing) {
      throw "Another Neven validation owns the lock. runId=$($Existing.runId) ownerPid=$($Existing.ownerPid) lock=$LockPath"
    }
    throw "Could not acquire validation lock at ${LockPath}: $($_.Exception.Message)"
  }
}

function Release-ValidationLock {
  if (-not (Test-Path $LockPath)) {
    return
  }

  try {
    $Existing = Get-Content -Raw -LiteralPath $LockPath | ConvertFrom-Json
    if ($Existing.runId -eq $RunId) {
      Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue
      Write-NevenLog "released validation lock runId=$RunId"
    } else {
      Write-NevenLog "left validation lock owned by another run runId=$($Existing.runId)"
    }
  } catch {
    Write-NevenLog "could not release validation lock: $($_.Exception.Message)"
  }
}

function Classify-BrowserIssues {
  param([object[]]$Issues)

  $Joined = (($Issues | ForEach-Object { [string]$_ }) -join " | ").ToLowerInvariant()

  if ([string]::IsNullOrWhiteSpace($Joined)) {
    return [pscustomobject]@{ kind = "healthy"; recoverable = $false; reason = "Browser health passed."; recommendedAction = "No remediation required." }
  }

  if ($Joined.Contains("spawn eperm") -or $Joined.Contains("executable doesn't exist")) {
    return [pscustomobject]@{ kind = "unrecoverable-browser-runtime"; recoverable = $false; reason = "Browser runtime is unavailable to the current process."; recommendedAction = "Verify Playwright installation and sandbox permissions." }
  }

  if ($Joined.Contains("hydration failed") -or $Joined.Contains("hydration mismatch")) {
    return [pscustomobject]@{ kind = "unrecoverable-app-hydration"; recoverable = $false; reason = "The application rendered a React hydration error."; recommendedAction = "Fix the deterministic render mismatch, then rerun npm run neven." }
  }

  if ($Joined.Contains("http 500") -or $Joined.Contains("internal server error") -or $Joined.Contains("request failed") -or $Joined.Contains("net::err_aborted") -or $Joined.Contains("net::err_failed")) {
    return [pscustomobject]@{ kind = "recoverable-server-state"; recoverable = $true; reason = "The app or supervisor reported a transient server/resource failure."; recommendedAction = "Run bounded supervisor repair and verify health again." }
  }

  return [pscustomobject]@{ kind = "unknown-browser-health-failure"; recoverable = $false; reason = "Browser health failed with an unsupported issue type."; recommendedAction = "Run npm run neven:diagnose and inspect browser-health evidence." }
}

function Invoke-SupervisorRepair {
  param([int]$TimeoutSeconds = 10)

  Assert-TotalTimeout
  $Result = Invoke-SupervisorJson -Path "/repair" -Body @{ runId = $RunId; source = "neven-validation" }
  return $Result
}

function Invoke-SupervisorRemediation {
  param(
    [object]$BrowserCheck,
    [int]$TimeoutSeconds
  )

  $script:RemediationAttempts += 1
  $StageDeadline = (Get-Date).AddSeconds($TimeoutSeconds)

  Set-ActiveSubstage "health-check"
  $BeforeStatus = Get-SupervisorStatus
  if ($null -eq $BeforeStatus) {
    throw "Supervisor status is unavailable before remediation."
  }
  $BeforeStale = @(Get-StaleRunningTasks -Status $BeforeStatus)
  Write-NevenLog "remediation health status=$($BeforeStatus.state.status) queue=$($BeforeStatus.queueLength) staleRunning=$($BeforeStale.Count)"

  if ((Get-Date) -gt $StageDeadline) {
    throw "Remediation timed out before diagnosis."
  }

  Set-ActiveSubstage "diagnosis"
  $Diagnosis = Classify-BrowserIssues -Issues $BrowserCheck.issues
  Write-NevenLog "remediation diagnosis kind=$($Diagnosis.kind) recoverable=$($Diagnosis.recoverable) reason=$($Diagnosis.reason)"

  if (-not $Diagnosis.recoverable -and $BeforeStale.Count -eq 0) {
    throw "Unrecoverable browser health failure: $($Diagnosis.reason) Recommended action: $($Diagnosis.recommendedAction)"
  }

  Set-ActiveSubstage "remediation"
  $RepairResult = Invoke-SupervisorRepair -TimeoutSeconds ([math]::Min(10, [math]::Max(1, [int](($StageDeadline - (Get-Date)).TotalSeconds))))
  Write-NevenLog "remediation repair ok=$($RepairResult.ok) repaired=$($RepairResult.repaired)"

  if ((Get-Date) -gt $StageDeadline) {
    throw "Remediation timed out after repair."
  }

  Set-ActiveSubstage "post-remediation-verification"
  $AfterStatus = Get-SupervisorStatus
  if ($null -eq $AfterStatus) {
    throw "Supervisor status is unavailable after remediation."
  }
  $AfterStale = @(Get-StaleRunningTasks -Status $AfterStatus)
  if ($AfterStale.Count -gt 0) {
    throw "Post-remediation verification failed. Stale running supervisor tasks remain: $($AfterStale.id -join ', ')"
  }

  Write-NevenLog "remediation post-check passed queue=$($AfterStatus.queueLength) activeTaskId=$($AfterStatus.activeTaskId)"
}

function Write-FailureDiagnostics {
  param([string]$Reason)

  Write-Output "LAST_ACTIVE_STAGE=$LastActiveStage"
  Write-Output "LAST_ACTIVE_SUBSTAGE=$LastActiveSubstage"
  Write-Output "ELAPSED_SECONDS=$(Get-ElapsedSeconds)"
  Write-Output "LATEST_SUCCESSFUL_CHECKPOINT=$LatestSuccessfulCheckpoint"
  Write-Output "REMEDIATION_ATTEMPTS=$RemediationAttempts"
  Write-Output "FAILURE_REASON=$Reason"

  $Ports = Get-PortOwners -Ports @(3000, 4010)
  if ($Ports.Count -gt 0) {
    Write-Output "PORTS_LISTENING=$($Ports | ConvertTo-Json -Compress)"
  } else {
    Write-Output "PORTS_LISTENING=[]"
  }

  $Started = @($StartedProcesses | ForEach-Object {
    [pscustomobject]@{ id = $_.Id; hasExited = $_.HasExited; processName = $_.ProcessName }
  })
  Write-Output "CHILD_PROCESSES_STARTED_BY_RUN=$($Started | ConvertTo-Json -Compress)"
  Write-Output "LATEST_LOG_LINES=$((Get-RecentLogLines -Path (Join-Path $EvidenceDir "actions.log") -Count 8) -join " || ")"
  Write-Output "CLEANUP_RESULT=$CleanupResult"
  Write-Output "RECOMMENDED_NEXT_DIAGNOSTIC=npm run neven:diagnose"
}

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
    [int]$TimeoutSeconds
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $NextProgressAt = Get-Date

  while ((Get-Date) -lt $Deadline) {
    Assert-TotalTimeout
    if (Test-Url $Url) {
      return
    }

    if ((Get-Date) -ge $NextProgressAt) {
      Write-NevenLog "waiting for $Name health at $Url"
      $NextProgressAt = (Get-Date).AddSeconds(5)
    }

    Start-Sleep -Seconds 1
  }

  throw "$Name did not become healthy within ${TimeoutSeconds}s. Last active stage: $script:LastActiveStage."
}

function Start-TrackedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  $Process = Start-Process -FilePath $FilePath `
    -WindowStyle Hidden `
    -WorkingDirectory $Root `
    -ArgumentList $ArgumentList `
    -PassThru

  $StartedProcesses.Add($Process) | Out-Null
  Write-NevenLog "started child process pid=$($Process.Id) file=$FilePath"
  return $Process
}

function Invoke-SupervisorJson {
  param(
    [string]$Path,
    [object]$Body = $null
  )

  Assert-TotalTimeout
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
    [int]$TimeoutSeconds
  )

  $TerminalStatuses = @("complete", "failed", "stopped")
  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $LastStatus = "not observed"
  $NextProgressAt = Get-Date

  while ((Get-Date) -lt $Deadline) {
    Assert-TotalTimeout
    $script:LastActiveStage = "supervisor-task:$TaskId"
    $Status = Invoke-SupervisorJson -Path "/status"
    $Task = $Status.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1

    if ($null -ne $Task) {
      $LastStatus = $Task.status
    }

    if ($null -ne $Task -and $TerminalStatuses -contains $Task.status) {
      if ($Task.status -eq "complete") {
        return
      }

      if ($Task.lastIssue) {
        throw "Supervisor task failed: $($Task.lastIssue)"
      }

      throw "Supervisor task ended with status $($Task.status)."
    }

    if ((Get-Date) -ge $NextProgressAt) {
      Write-NevenLog "supervisor task pending id=$TaskId status=$LastStatus"
      $NextProgressAt = (Get-Date).AddSeconds(10)
    }

    Start-Sleep -Seconds 2
  }

  throw "Supervisor task $TaskId did not complete within ${TimeoutSeconds}s. Last observed status: $LastStatus. Last active stage: $script:LastActiveStage."
}

function Invoke-BrowserHealthCheck {
  param(
    [string]$Url,
    [string]$ScreenshotName,
    [int]$TimeoutSeconds
  )

  New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
  $ScreenshotPath = Join-Path $EvidenceDir $ScreenshotName
  $TempRoot = [System.IO.Path]::GetTempPath()
  $ScriptPath = Join-Path $TempRoot "neven-browser-health.cjs"
  $StdoutPath = Join-Path $TempRoot "neven-browser-health.out.json"
  $StderrPath = Join-Path $TempRoot "neven-browser-health.err.log"
  $BrowserScript = @'
const { chromium } = require("playwright");

const url = process.argv[2];
const screenshotPath = process.argv[3];
const issues = [];

function conciseError(error) {
  return String(error && error.message ? error.message : error).split(/\r?\n/)[0];
}

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
    issues.push(`browser check failed: ${conciseError(error)}`);
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
    issues: [`browser check failed: ${conciseError(error)}`],
    screenshotPath
  }));
});
'@

  [System.IO.File]::WriteAllText($ScriptPath, $BrowserScript)
  Remove-Item -LiteralPath $StdoutPath, $StderrPath -Force -ErrorAction SilentlyContinue

  $Process = Start-Process -FilePath "node" `
    -WindowStyle Hidden `
    -WorkingDirectory $Root `
    -ArgumentList @($ScriptPath, $Url, $ScreenshotPath) `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath `
    -PassThru

  if (-not $Process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-ProcessTree -ProcessId $Process.Id
    throw "Browser health check exceeded ${TimeoutSeconds}s. Last active stage: $script:LastActiveStage."
  }
  $Process.WaitForExit() | Out-Null

  $Output = if (Test-Path $StdoutPath) { Get-Content -Raw $StdoutPath } else { "" }
  if ([string]::IsNullOrWhiteSpace($Output)) {
    $ErrorText = if (Test-Path $StderrPath) { (Get-Content -Raw $StderrPath) -replace "\s+", " " } else { "" }
    throw "Browser health check failed to return output. $ErrorText"
  }

  $Output | ConvertFrom-Json
}

function Submit-Task {
  param(
    [string]$Goal,
    [int]$TimeoutSeconds
  )

  $SubmittedTask = Invoke-SupervisorJson -Path "/task" -Body @{
    goal = $Goal
    approved = $true
  }

  if ($null -eq $SubmittedTask.task -or [string]::IsNullOrWhiteSpace($SubmittedTask.task.id)) {
    throw "Supervisor did not accept the task."
  }

  Wait-Task -TaskId $SubmittedTask.task.id -TimeoutSeconds $TimeoutSeconds
}

$Completed = $false

try {
  Write-NevenLog "validation start totalTimeout=${TotalTimeoutSeconds}s"
  Acquire-ValidationLock

  if ($RunRemediationProbe) {
    Invoke-Stage -Name "supervisor-remediation-task" -TimeoutSeconds $TaskTimeoutSeconds -Script {
      $ProbeBrowserCheck = [pscustomobject]@{
        ok = $false
        issues = @($ProbeIssue)
        screenshotPath = "probe"
      }
      Invoke-SupervisorRemediation -BrowserCheck $ProbeBrowserCheck -TimeoutSeconds $TaskTimeoutSeconds
    }

    $Completed = $true
    Write-Output "REMEDIATION_PROBE=OK"
    Write-Output "LAST_ACTIVE_STAGE=$LastActiveStage"
    Write-Output "LAST_ACTIVE_SUBSTAGE=$LastActiveSubstage"
    Write-Output "TOTAL_ELAPSED_SECONDS=$(Get-ElapsedSeconds)"
    return
  }

  Invoke-Stage -Name "app-health" -TimeoutSeconds $AppTimeoutSeconds -Script {
    if (-not (Test-Url $AppUrl)) {
      Start-TrackedProcess -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "npm run dev"
      ) | Out-Null
    }

    Wait-Url -Url $AppUrl -Name "App" -TimeoutSeconds $AppTimeoutSeconds
  }

  Invoke-Stage -Name "supervisor-health" -TimeoutSeconds $SupervisorTimeoutSeconds -Script {
    if (-not (Test-Url "$SupervisorUrl/health")) {
      Start-TrackedProcess -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "`$env:NEVEN_SUPERVISOR_PORT='4010'; `$env:NEVEN_APP_URL='$AppUrl'; node --experimental-strip-types tools/neven-supervisor/supervisor.ts"
      ) | Out-Null
    }

    Wait-Url -Url "$SupervisorUrl/health" -Name "Supervisor" -TimeoutSeconds $SupervisorTimeoutSeconds
  }

  $BrowserCheck = $null
  Invoke-Stage -Name "browser-health-before" -TimeoutSeconds $BrowserTimeoutSeconds -Script {
    $script:BrowserCheck = Invoke-BrowserHealthCheck -Url $AppUrl -ScreenshotName "browser-health-before.png" -TimeoutSeconds $BrowserTimeoutSeconds
  }

  $LastTaskOk = $true
  if (-not $BrowserCheck.ok) {
    $LastTaskOk = $false

    Invoke-Stage -Name "supervisor-remediation-task" -TimeoutSeconds $TaskTimeoutSeconds -Script {
      Invoke-SupervisorRemediation -BrowserCheck $BrowserCheck -TimeoutSeconds $TaskTimeoutSeconds
      $script:LastTaskOk = $true
    }

    Invoke-Stage -Name "browser-health-after" -TimeoutSeconds $BrowserTimeoutSeconds -Script {
      $script:BrowserCheck = Invoke-BrowserHealthCheck -Url $AppUrl -ScreenshotName "browser-health-after.png" -TimeoutSeconds $BrowserTimeoutSeconds
      if (-not $BrowserCheck.ok) {
        $AfterIssueSummary = ($BrowserCheck.issues | Select-Object -First 3) -join "; "
        throw "Browser health check failed after remediation: $AfterIssueSummary"
      }
    }
  }

  if (-not $BrowserCheck.ok) {
    $IssueSummary = ($BrowserCheck.issues | Select-Object -First 3) -join "; "
    throw "Browser health check failed: $IssueSummary"
  }

  if (-not $LastTaskOk) {
    throw "Supervisor task did not complete."
  }

  Assert-TotalTimeout
  $Completed = $true
  Write-Output "APP=OK"
  Write-Output "SUPERVISOR=OK"
  Write-Output "BROWSER=OK"
  Write-Output "LAST_TASK=OK"
  Write-Output "LAST_ACTIVE_STAGE=$LastActiveStage"
  Write-Output "TOTAL_ELAPSED_SECONDS=$(Get-ElapsedSeconds)"
} catch {
  Write-NevenLog "ERROR $($_.Exception.Message -replace "\s+", " ")"
  if (-not $KeepStartedProcesses -and -not $CleanupPerformed) {
    Stop-StartedProcesses
    $script:CleanupPerformed = $true
  }
  Write-FailureDiagnostics -Reason ($_.Exception.Message -replace "\s+", " ")
  exit 1
} finally {
  if (-not $KeepStartedProcesses -and -not $CleanupPerformed) {
    Stop-StartedProcesses
    $script:CleanupPerformed = $true
  }
  Release-ValidationLock

  if (-not $Completed) {
    Write-NevenLog "validation incomplete"
  }
}
