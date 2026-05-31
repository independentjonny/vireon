# Windows Startup / Task Scheduler Instructions

## Register daemon as a scheduled Windows task (PowerShell, run as Administrator)

```powershell
$action = New-ScheduledTaskAction `
  -Execute "node" `
  -Argument "scripts/daemon.js" `
  -WorkingDirectory "C:\Users\summe\liberva"

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName "LibervaAutonomousDaemon" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -RunLevel Highest
```

## Heartbeat health check

- The daemon should write `lastBeat` to `.ai/operations/daemon.json` every minute.
- The `/api/runtime/heartbeat` endpoint reports `staleSeconds` — alert if > 1800.

## Pause / Resume (safe, no destructive shell)

- To pause: set `paused: true` in `.ai/operations/daemon.json`
- To resume: set `paused: false`
- The daemon checks this flag before each task iteration.

## Operations log directory

Daily logs are written to `.ai/operations/logs/YYYY-MM-DD.json`.
Safety summaries are appended to `.ai/operations/logs/safety-summary.json`.
