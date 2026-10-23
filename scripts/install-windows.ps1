# Installs Workday on Windows: checks Node.js, builds the app, starts the server and
# optionally registers a scheduled task named "Workday" that starts it at boot.
# Run from PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8080 }),
  [string]$HostAddress = $(if ($env:HOST) { $env:HOST } else { '0.0.0.0' }),
  [switch]$Service,
  [switch]$NoService
)

$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent $PSScriptRoot
$TaskName = 'Workday'

function Info($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Fail($message) { Write-Host "Error: $message" -ForegroundColor Red; exit 1 }

Info 'Checking Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js is not installed. Install Node.js 22 or newer from https://nodejs.org and run this script again.' }
$major = [int](& node -p "process.versions.node.split('.')[0]")
if ($major -lt 22) { Fail "Node.js 22 or newer is required (found $(& node -v))." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail 'npm is not installed.' }
Write-Host "Found Node.js $(& node -v)"

Set-Location $AppDir
Info 'Installing packages (npm ci)'
& npm ci
if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }

Info 'Building Workday (npm run build)'
& npm run build
if ($LASTEXITCODE -ne 0) { Fail 'The build failed.' }

$register = $Service.IsPresent
if (-not $Service -and -not $NoService) {
  $answer = Read-Host 'Register a scheduled task so Workday starts at boot? [y/N]'
  $register = $answer -match '^(y|yes)$'
}

$nodePath = $node.Source
$serverPath = Join-Path $AppDir 'server\server.mjs'

if ($register) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { Fail 'Registering a startup task needs an Administrator PowerShell window. Re-run this script as Administrator.' }

  Info "Registering scheduled task '$TaskName'"
  $command = "`$env:PORT='$Port'; `$env:HOST='$HostAddress'; & '$nodePath' '$serverPath'"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command `"$command`"" -WorkingDirectory $AppDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

  Info 'Starting Workday'
  Start-ScheduledTask -TaskName $TaskName
  Write-Host ''
  Write-Host "Workday is running at http://localhost:$Port"
  Write-Host "It will start automatically when Windows boots. Remove it with: Unregister-ScheduledTask -TaskName $TaskName"
} else {
  Info 'Starting Workday'
  $env:PORT = "$Port"
  $env:HOST = $HostAddress
  Start-Process -FilePath $nodePath -ArgumentList "`"$serverPath`"" -WorkingDirectory $AppDir -WindowStyle Minimized
  Write-Host ''
  Write-Host "Workday is running at http://localhost:$Port"
  Write-Host 'Close the minimized Node.js window to stop it, or start it again later with: npm start'
}
