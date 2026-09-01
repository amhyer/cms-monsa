$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host ""
  Write-Host "Node.js belum terpasang." -ForegroundColor Yellow
  Write-Host "Unduh LTS dari https://nodejs.org lalu pasang (centang Add to PATH)."
  Write-Host "Setelah itu buka ulang jendela ini dan jalankan lagi."
  Write-Host ""
  Pause
  exit 1
}

Write-Host "Menjalankan Jembatan Dapodik..." -ForegroundColor Cyan
Write-Host "Browser akan membuka http://127.0.0.1:3847"
Write-Host "Tekan Ctrl+C di jendela ini untuk berhenti."
Write-Host ""
& node ".\jembatan.mjs"
