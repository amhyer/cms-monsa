# 🚀 Panduan Build untuk Developer

Dokumen ini untuk developer yang ingin mem-build file executable dari source code.

## Prasyarat

- Node.js 18 atau lebih baru
- npm atau yarn
- OS: Windows, macOS, atau Linux

## Cara Build

### 1. Clone Repository

```bash
git clone https://github.com/amhyer/cms-monsa.git
cd cms-monsa/dapodik-jembatan
```

### 2. Install Dependencies

```bash
cd builder
npm install
```

### 3. Build Executable

#### Build untuk Windows saja:
```bash
npm run build:win
```
Output: `dist/Jembatan-Dapodik.exe`

#### Build untuk semua platform:
```bash
npm run build:all
```
Output:
- `dist/Jembatan-Dapodik.exe` (Windows)
- `dist/Jembatan-Dapodik-macos` (macOS)
- `dist/Jembatan-Dapodik-linux` (Linux)

### 4. Test Build

Jalankan executable yang sudah di-build:
```bash
# Windows
./dist/Jembatan-Dapodik.exe

# macOS/Linux
chmod +x ./dist/Jembatan-Dapodik-macos
./dist/Jembatan-Dapodik-macos
```

## Build dengan GitHub Actions (Otomatis)

Setiap push ke branch main atau release akan otomatis mem-build executable:

1. Push perubahan ke `dapodik-jembatan/jembatan.mjs` atau `jembatan-cli.mjs`
2. GitHub Actions akan otomatis build
3. Download artifact dari tab Actions

Untuk release:
1. Buat tag GitHub release
2. File executable akan otomatis di-upload ke release

## Troubleshooting Build

### Error: pkg not found

```bash
npm install -g pkg
```

### Error: Build timeout

Build pkg bisa memakan waktu cukup lama. Pastikan koneksi internet stabil.

### Error: Permission denied (macOS/Linux)

```bash
chmod +x ./dist/Jembatan-Dapodik-*
```

## Struktur File Build

```
dapodik-jembatan/
├── jembatan.mjs           # Source utama (GUI version)
├── jembatan-cli.mjs       # Source CLI version
├── builder/
│   ├── package.json      # Dependencies
│   ├── build.js          # Script build
│   └── scripts/
│       └── prepare-build.js
└── dist/                 # Output executables
    ├── Jembatan-Dapodik.exe
    ├── Jembatan-Dapodik-macos
    └── Jembatan-Dapodik-linux
```

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
