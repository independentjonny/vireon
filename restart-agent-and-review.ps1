param(
  [int]$Port = 4002
)

$ErrorActionPreference = "Stop"

Write-Host "Stopping any process on port $Port..."

$lines = netstat -ano | Select-String ":$Port" | Where-Object { $_ -match "LISTENING" }

foreach ($line in $lines) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
  $processId = [int]$parts[-1]
  Write-Host "Stopping PID $processId"
  Stop-Process -Id $processId -Force
}

Start-Sleep -Seconds 1

Write-Host "Starting Neven agent server..."

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd C:\Users\summe\liberva; npx tsx tools\neven-agent\agent-server.ts"
)

Start-Sleep -Seconds 4

Write-Host "Testing aiReviewUI..."

$r = Invoke-RestMethod `
  -Uri "http://localhost:$Port/run-agent" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"action":"aiReviewUI"}'

$r.summary
