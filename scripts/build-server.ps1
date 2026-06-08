# Gera meuplayer-server.exe (servidor Go embutido) para o build do Electron.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
    Write-Error "Go não encontrado no PATH. Instale o Go e tente novamente."
}

Write-Host "Compilando meuplayer-server.exe..."
if (-not (Test-Path "dist-server")) {
    New-Item -ItemType Directory -Path "dist-server" | Out-Null
}

go build -ldflags="-s -w" -o dist-server/meuplayer-server.exe .

if (-not (Test-Path "dist-server\meuplayer-server.exe")) {
    Write-Error "Build falhou: dist-server\meuplayer-server.exe não foi criado."
}

Write-Host "OK: dist-server\meuplayer-server.exe"
