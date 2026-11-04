$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Create the virtual environment and install requirements first. See README.md.'
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\dist\index.html'))) {
    throw 'Build the frontend first: npm run build --prefix frontend'
}
$health = $null
try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health/' -TimeoutSec 2 } catch {}
if ($health.status -eq 'ok' -and $health.service -eq 'weather-aware-routing') {
    Write-Output 'Wayfinder is already running at http://127.0.0.1:8000'
    exit 0
}
if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 8000 is occupied by another service. It has been left untouched.'
}
$artifactDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
$process = Start-Process -FilePath $pythonExe -ArgumentList @('-m', 'waitress', '--listen=127.0.0.1:8000', '--threads=6', 'config.wsgi:application') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $artifactDir 'server.out.log') -RedirectStandardError (Join-Path $artifactDir 'server.err.log') -PassThru
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $ready = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health/' -TimeoutSec 2
        if ($ready.status -eq 'ok' -and $ready.service -eq 'weather-aware-routing') {
            Write-Output "Wayfinder ready (PID $($process.Id)): http://127.0.0.1:8000"
            exit 0
        }
    } catch {}
    Start-Sleep -Milliseconds 250
}
throw 'Wayfinder did not become ready. Check artifacts/server.err.log.'
