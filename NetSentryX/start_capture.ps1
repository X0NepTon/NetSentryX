<#
.SYNOPSIS
  Start IDS packet capture on Windows (native, no WSL).

USAGE
  Open PowerShell as Administrator, cd to project root and run:
    .\start_capture.ps1 -Interface "Ethernet" 

  Or set environment variables: $env:INTERFACE, $env:API_URL

NOTES
  - Requires Npcap installed (https://nmap.org/npcap/)
  - Run PowerShell as Administrator to allow raw packet capture
  - Preferably install project dependencies into `.venv` first
#>
param(
  [string]$Interface = $env:INTERFACE,
  [int]$Window = 5,
  [int]$Step = 1,
  [string]$Bpf = $env:BPF -or 'ip',
  [string]$ApiUrl = $env:API_URL -or 'http://127.0.0.1:8000/detect'
)

function Is-RunningAsAdmin {
  $current = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($current)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Is-RunningAsAdmin)) {
  Write-Warning "This script should be run from an Administrator PowerShell. Re-run as Administrator."
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = $env:NETSENTRYX_PROJECT_DIR -or $ScriptDir
Set-Location $ProjectDir

# Prefer venv python
$VenvPython = Join-Path $ProjectDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
  $Python = $VenvPython
} else {
  $pyCmd = Get-Command python3 -ErrorAction SilentlyContinue || Get-Command python -ErrorAction SilentlyContinue
  if ($pyCmd) { $Python = $pyCmd.Path } else { Write-Error "Python not found. Install Python 3 or create .venv."; exit 2 }
  Write-Warning ".venv not found — using system Python: $Python"
}

if (-not $Interface) {
  Write-Host "No interface provided. Listing available network adapters (Name - InterfaceDescription):`n"
  Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Format-Table -Property ifIndex, Name, InterfaceDescription -AutoSize
  Write-Host "`nRe-run script with `-Interface <Name>` or set `INTERFACE` env var and re-run. Example:`n  .\\start_capture.ps1 -Interface 'Ethernet'"
  exit 1
}

Write-Host "Starting IDS Packet Capture..."
Write-Host "Project dir: $ProjectDir"
Write-Host "Interface: $Interface"
Write-Host "Window: $Window sec, Step: $Step sec"
Write-Host "BPF: $Bpf"
Write-Host "API: $ApiUrl`n"

$argsList = @(
  'realtime_agent/realtime_extractor.py',
  '--mode','live',
  '--iface',$Interface,
  '--window',$Window.ToString(),
  '--step',$Step.ToString(),
  '--post',
  '--api-url',$ApiUrl,
  '--bpf',$Bpf
)

& $Python $argsList

if ($LASTEXITCODE -ne 0) { Write-Error "Capture process exited with code $LASTEXITCODE" }
