# 🚀 Panduan Build untuk Developer

Dokumen ini untuk developer yang ingin mem-build file executable dari source code.

## Prasyarat

- **Bun** terinstall (project ini memakai bun — lihat `bun.lock` di root repo)
- OS: Windows, macOS, atau Linux (bun mendukung cross-compile antar platform)

## Cara Build

### 1. Clone Repository

```bash
git clone https://github.com/amhyer/cms-monsa.git
cd cms-monsa
```

### 2. Build Executable

```bash
# Windows saja
node dapodik-jembatan/builder/build.js win
# → dapodik-jembatan/dist/Jembatan-Dapodik.exe

# Semua platform (Windows + macOS + Linux)
node dapodik-jembatan/builder/build.js all
# → dist/Jembatan-Dapodik.exe, -macos, -linux
```

Tidak ada dependency lain: `build.js` hanya memanggil `bun build --compile`
dengan target platform (`bun-windows-x64`, `bun-darwin-x64`, `bun-linux-x64`).

### 3. Test Build

Jalankan executable yang sudah di-build:

```bash
# Windows: double-click, atau dari terminal
./dapodik-jembatan/dist/Jembatan-Dapodik.exe --help

# macOS/Linux
chmod +x ./dapodik-jembatan/dist/Jembatan-Dapodik-macos
./dapodik-jembatan/dist/Jembatan-Dapodik-macos --help
```

Tanpa argumen executable menjalankan server + UI browser di
`http://localhost:3847`. Subcommand `test | preview | sync | config`
menjalankan mode CLI (lihat `--help`).

## Build dengan GitHub Actions (Otomatis)

Workflow `.github/workflows/build-jembatan.yml` otomatis mem-build ketiga
platform pada setiap push yang menyentuh `dapodik-jembatan/jembatan.mjs` atau
`dapodik-jembatan/builder/**`:

1. Push perubahan
2. GitHub Actions build Windows, macOS, dan Linux (cross-compile dari ubuntu)
3. Binary Linux di-smoke-test (server + subcommand CLI) sebelum di-upload
4. Download artifact dari tab Actions

Untuk release:
1. Buat tag GitHub release
2. File executable otomatis di-upload ke release

## Troubleshooting Build

### Error: bun tidak ditemukan

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Error: cross-compile gagal

Pastikan versi bun cukup baru (`bun --version`). Cross-compile antar platform
didukung sejak bun 1.1. Kalau masih gagal, build di mesin dengan OS target.

### Error: Permission denied (macOS/Linux)

```bash
chmod +x ./dapodik-jembatan/dist/Jembatan-Dapodik-*
```

## Struktur File Build

```
dapodik-jembatan/
├── jembatan.mjs           # Satu source: server UI + subcommand CLI
├── builder/
│   └── build.js           # Wrapper bun build --compile
└── dist/                  # Output executables (di-gitignore)
    ├── Jembatan-Dapodik.exe
    ├── Jembatan-Dapodik-macos
    └── Jembatan-Dapodik-linux
```

Catatan: file konfigurasi (`jembatan-config.json`) disimpan di samping file
executable (bukan di dalam snapshot build) sehingga pengaturan bertahan
lintas restart di PC sekolah.

## Deployment ke User

### Untuk Operator Sekolah

1. Download file executable dari release page atau artifact
2. Simpan di folder yang mudah diakses
3. Double-click untuk jalankan
4. Ikuti panduan di README-OPERATOR.md

### Distribusi Offline

Untuk sekolah dengan koneksi internet terbatas:

1. Build executable di komputer dengan koneksi baik
2. Copy ke flashdisk
3. Distribusikan ke sekolah
4. Operator tinggal jalankan tanpa install apapun