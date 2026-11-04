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
$artifactDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
$process = Start-Process -FilePath $pythonExe -ArgumentList @('-m', 'waitress', '--listen=127.0.0.1:8000', '--threads=6', 'config.wsgi:application') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $artifactDir 'server.out.log') -RedirectStandardError (Join-Path $artifactDir 'server.err.log') -PassThru
Write-Output "Wayfinder started (PID $($process.Id)): http://127.0.0.1:8000"
