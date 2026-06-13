$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$AppUrl = "http://localhost:3000"
$SupervisorUrl = "http://localhost:4010"

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
    $Arguments.Body = ($Body | ConvertTo-Json -Compress)
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
        throw "Supervisor health task failed: $($Task.lastIssue)"
      }

      throw "Supervisor health task ended with status $($Task.status)."
    }

    Start-Sleep -Seconds 2
  }

  throw "Supervisor health task did not complete."
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
      "`$env:NEVEN_SUPERVISOR_PORT='4010'; node --experimental-strip-types tools/neven-supervisor/supervisor.ts"
    ) | Out-Null
  }

  Wait-Url -Url $AppUrl -Name "App"
  Write-Output "APP CHECK OK"
  Wait-Url -Url "$SupervisorUrl/health" -Name "Supervisor"
  Write-Output "SUPERVISOR CHECK OK"

  $SubmittedTask = Invoke-SupervisorJson -Path "/task" -Body @{
    goal = "Run Neven supervisor health task and report readiness without manual steps."
    approved = $true
  }

  if ($null -eq $SubmittedTask.task -or [string]::IsNullOrWhiteSpace($SubmittedTask.task.id)) {
    throw "Supervisor did not accept the health task."
  }

  Wait-Task -TaskId $SubmittedTask.task.id
  Write-Output "HEALTH TASK OK"

  Write-Output "APP=OK"
  Write-Output "SUPERVISOR=OK"
  Write-Output "LAST_TASK=OK"
} catch {
  Write-Output ($_.Exception.Message -replace "\s+", " ")
  exit 1
}
