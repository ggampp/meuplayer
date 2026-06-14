# Gera meuplayer-server.exe (servidor Go embutido) para o build do Electron.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
    Write-Error "Go não encontrado no PATH. Instale o Go e tente novamente."
}

Write-Host "Compilando meuplayer-server.exe (Windows)..."
if (-not (Test-Path "dist-server")) {
    New-Item -ItemType Directory -Path "dist-server" | Out-Null
}

go build -ldflags="-s -w" -o dist-server/meuplayer-server.exe ./cmd/server

if (-not (Test-Path "dist-server\meuplayer-server.exe")) {
    Write-Error "Build falhou: dist-server\meuplayer-server.exe não foi criado."
}

Write-Host "OK: dist-server\meuplayer-server.exe"

# Gera também o binário para Linux (útil para deploys VPS ou uso local sem Electron)
Write-Host "Compilando meuplayer-server (Linux)..."
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -ldflags="-s -w" -o dist-server/meuplayer-server-linux ./cmd/server

if (-not (Test-Path "dist-server\meuplayer-server-linux")) {
    Write-Error "Build do Linux falhou."
} else {
    Write-Host "OK: dist-server\meuplayer-server-linux (GOOS=linux)"
}

# Limpa variáveis de ambiente do Go (boa prática no PowerShell)
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Builds do servidor concluídos."
Write-Host "Copie os binários desejados para public/downloads/ (pasta ignorada pelo git) ou faça upload para GitHub Releases."
