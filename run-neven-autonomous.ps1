$ErrorActionPreference = "Continue"
cd C:\Users\summe\liberva

Write-Host "=== NEVEN AUTONOMOUS RUN ==="

if (-not (Test-Path ".env.local")) {
  Write-Host "ERROR: .env.local missing. Add OPENAI_API_KEY first."
  exit 1
}

Write-Host "Stopping agent on 4002..."
$lines = netstat -ano | Select-String ":4002" | Where-Object { $_ -match "LISTENING" }
foreach ($line in $lines) {
  $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
  $processId = [int]$parts[-1]
  Stop-Process -Id $processId -Force
}

Write-Host "Checking Neven app on 3000..."
try {
  Invoke-WebRequest http://localhost:3000 -UseBasicParsing | Out-Null
} catch {
  Write-Host "ERROR: localhost:3000 is down. Start it with: npm run dev"
  exit 1
}

Write-Host "Starting agent..."
$agent = Start-Process powershell -PassThru -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd C:\Users\summe\liberva; npx tsx tools\neven-agent\agent-server.ts"
)

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

Write-Host "Opening screenshots..."
start .ai-agent-runs\latest-desktop.png
start .ai-agent-runs\latest-mobile.png

Write-Host "DONE. Review .ai-agent-runs\latest-autonomous-report.txt"
