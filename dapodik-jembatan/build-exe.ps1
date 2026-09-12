# ==============================================================
#  Jembatan Dapodik — build Jembatan-Dapodik.exe (Windows x64)
#
#  Hasil: Jembatan-Dapodik.exe di folder ini. EXE berdiri sendiri —
#  PC sekolah TIDAK perlu install Node.js atau Bun.
#
#  Cara pakai (di komputer developer):
#    1. Install Bun sekali saja:
#         powershell -c "irm bun.sh/install.ps1 | iex"
#       lalu buka terminal baru.
#    2. Jalankan script ini:
#         .\build-exe.ps1
#
#  Catatan: JANGAN pakai vercel/pkg — pkg tidak mendukung ES Module
#  (.mjs) sehingga exe-nya error "Cannot find module C:\snapshot\...".
# ==============================================================
param(
  [string]$Out = "Jembatan-Dapodik.exe"
)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "[ERROR] Bun belum terpasang atau belum masuk PATH." -ForegroundColor Red
  Write-Host "Instal sekali saja, lalu buka terminal baru:"
  Write-Host '  powershell -c "irm bun.sh/install.ps1 | iex"'
  Write-Host ""
  exit 1
}

Write-Host "Membangun $Out (target: bun-windows-x64)..." -ForegroundColor Cyan
bun build --compile --target=bun-windows-x64 --outfile $Out `
  --windows-title "Jembatan Dapodik" `
  --windows-publisher "CMS MONSA" `
  --windows-version 1.0.0 `
  --windows-description "Jembatan Dapodik - tarik data Dapodik PC sekolah ke CMS MONSA" `
  .\jembatan.mjs

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[ERROR] Build gagal. Coba: bun update  lalu ulangi script ini." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Selesai: $PSScriptRoot\$Out" -ForegroundColor Green
Write-Host "Langkah berikutnya: zip file exe itu, kirim ke PC sekolah,"
Write-Host "lalu double-klik Jembatan-Dapodik.exe (tanpa install apa pun)."
