$ErrorActionPreference = "Continue"
cd C:\Users\summe\liberva

Write-Host "=== NEVEN AUTONOMOUS RUN ==="

$devOk = $false
try {
  Invoke-WebRequest http://localhost:3000 -UseBasicParsing | Out-Null
  $devOk = $true
} catch {
  Write-Host "Starting Next dev server..."
  Start-Process powershell -ArgumentList "-NoExit","-Command","cd C:\Users\summe\liberva; npm run dev"
  Start-Sleep -Seconds 10
}

Write-Host "Restarting agent on 4002..."
$lines = netstat -ano | Select-String ":4002" | Where-Object { $_ -match "LISTENING" }
foreach ($line in $lines) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
  $processId = [int]$parts[-1]
  Stop-Process -Id $processId -Force
}

Start-Process powershell -ArgumentList "-NoExit","-Command","cd C:\Users\summe\liberva; npx tsx tools\neven-agent\agent-server.ts"
Start-Sleep -Seconds 5

Write-Host "Running autonomousBuild..."
$r = Invoke-RestMethod `
  -Uri http://localhost:4002/run-agent `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"action":"autonomousBuild","iterations":1}'

$r.summary | Tee-Object .ai-agent-runs\latest-autonomous-report.txt

Write-Host "Git status:"
git status --short

Write-Host "Opening report and screenshots..."
notepad .ai-agent-runs\latest-autonomous-report.txt
start .ai-agent-runs\latest-desktop.png
start .ai-agent-runs\latest-mobile.png

Write-Host "DONE"
