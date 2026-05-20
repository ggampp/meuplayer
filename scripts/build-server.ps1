# Gera meuplayer-server.exe (servidor Python embutido) para o build do Electron.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Error "Python não encontrado no PATH. Instale Python 3 e tente novamente."
}

Write-Host "Instalando PyInstaller (se necessário)..."
python -m pip install --upgrade pyinstaller -q

Write-Host "Compilando meuplayer-server.exe..."
python -m PyInstaller `
    --onefile `
    --name meuplayer-server `
    --distpath dist-server `
    --workpath build-server `
    --specpath build-server `
    --clean `
    server.py cache_db.py

if (-not (Test-Path "dist-server\meuplayer-server.exe")) {
    Write-Error "Build falhou: dist-server\meuplayer-server.exe não foi criado."
}

Write-Host "OK: dist-server\meuplayer-server.exe"
