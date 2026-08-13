#Requires -Version 5.1
param(
    [ValidateSet('start', 'stop')]
    [string]$Action = 'start'
)

$Root = $PSScriptRoot
$PidFile = Join-Path $Root '.dev.pids'

function Start-Dev {
    if (Test-Path $PidFile) {
        Write-Host "Already running. Run '.\dev.ps1 stop' first."
        exit 1
    }

    Write-Host 'Installing server dependencies...'
    Push-Location (Join-Path $Root 'server')
    npm install --silent
    Pop-Location

    Write-Host 'Installing client dependencies...'
    Push-Location (Join-Path $Root 'client')
    npm install --silent
    Pop-Location

    Write-Host 'Starting server (port 3001)...'
    $serverProc = Start-Process -FilePath 'node' -ArgumentList 'index.js' `
        -WorkingDirectory (Join-Path $Root 'server') -PassThru

    Write-Host 'Starting client (port 5173)...'
    $clientProc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' `
        -WorkingDirectory (Join-Path $Root 'client') -PassThru

    "$($serverProc.Id) $($clientProc.Id)" | Set-Content -Path $PidFile -Encoding utf8

    Write-Host "Started — server PID $($serverProc.Id), client PID $($clientProc.Id)"
    Write-Host "Run '.\dev.ps1 stop' to shut down."

    Wait-Process -Id $serverProc.Id, $clientProc.Id -ErrorAction SilentlyContinue
}

function Stop-Dev {
    if (-not (Test-Path $PidFile)) {
        Write-Host 'No running processes found.'
        exit 0
    }

    $pids = (Get-Content $PidFile -Raw).Trim() -split '\s+'
    Write-Host "Stopping server (PID $($pids[0])) and client (PID $($pids[1]))..."

    foreach ($procId in $pids) {
        # npm.cmd spawns cmd.exe -> node (vite/nodemon...), so Stop-Process alone
        # only kills the top-level wrapper and leaves the real dev server running.
        taskkill /PID $procId /T /F 2>$null | Out-Null
    }

    Remove-Item $PidFile -Force
    Write-Host 'Stopped.'
}

switch ($Action) {
    'start' { Start-Dev }
    'stop'  { Stop-Dev }
    default { Write-Host 'Usage: .\dev.ps1 [start|stop]' }
}
