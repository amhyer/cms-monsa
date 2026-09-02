@echo off
setlocal
cd /d "%~dp0"
title Jembatan Dapodik - CMS MONSA

echo ========================================
echo   Jembatan Dapodik - CMS MONSA
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 goto node_tidak_ada

echo Node.js terdeteksi:
node --version
echo.
echo Menjalankan Jembatan Dapodik...
echo Jika browser tidak terbuka, buka http://127.0.0.1:3847
echo Jangan tutup jendela ini selama penarikan data.
echo.

node "%~dp0jembatan.mjs"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo Jembatan Dapodik telah berhenti.
) else (
  echo [ERROR] Jembatan Dapodik gagal dijalankan. Kode: %EXIT_CODE%
  echo Salin atau foto pesan kesalahan di atas untuk pemeriksaan.
)
echo.
pause
exit /b %EXIT_CODE%

:node_tidak_ada
echo [ERROR] Node.js belum terpasang atau belum masuk PATH.
echo Unduh Node.js LTS dari https://nodejs.org lalu pasang.
echo Setelah instalasi selesai, tutup dan buka kembali folder ini.
echo.
pause
exit /b 1
