# build.ps1 — Build GOG Downloader portable Windows app
#
# Requirements:
#   - Node.js (npm)
#   - Python 3.11+ (python / pip on PATH)
#
# Usage:
#   .\build.ps1
#
# Output:
#   dist\GOG-Downloader\GOG-Downloader.exe  (and supporting files)
#   Zip the dist\GOG-Downloader\ folder to share.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  GOG Downloader — portable build" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build the React frontend ─────────────────────────────────────────
Write-Host "[1/3] Building frontend..." -ForegroundColor Yellow
Push-Location (Join-Path $root "frontend")
try {
    npm install --prefer-offline
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
    Pop-Location
}
Write-Host "      Frontend built -> frontend\dist" -ForegroundColor Green

# ── Step 2: Install Python dependencies ──────────────────────────────────────
Write-Host "[2/3] Installing Python dependencies..." -ForegroundColor Yellow
Push-Location $root
try {
    pip install -r requirements.txt --quiet
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
} finally {
    Pop-Location
}
Write-Host "      Python deps installed" -ForegroundColor Green

# ── Step 3: Package with PyInstaller ─────────────────────────────────────────
Write-Host "[3/3] Packaging with PyInstaller..." -ForegroundColor Yellow
Push-Location $root
try {
    pyinstaller launcher.spec --noconfirm
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
} finally {
    Pop-Location
}
Write-Host "      Package ready" -ForegroundColor Green

# ── Done ─────────────────────────────────────────────────────────────────────
$outDir = Join-Path $root "dist\GOG-Downloader"
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "  Output: $outDir" -ForegroundColor Green
Write-Host ""
Write-Host "  To share: zip the GOG-Downloader folder." -ForegroundColor White
Write-Host "  To run:   double-click GOG-Downloader.exe" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
