# Folder Downloads

## Isi Folder

Folder ini berisi file executable aplikasi Jembatan Dapodik:

- `Jembatan-Dapodik.exe` - Untuk Windows
- `Jembatan-Dapodik-macos` - Untuk macOS
- `Jembatan-Dapodik-linux` - Untuk Linux

## Cara Mendapatkan File Executable

### Opsi 1: Build dari Source Code

1. Clone repository ini
2. Jalankan build script:

```bash
cd dapodik-jembatan/builder
npm install
npm run build:win    # Untuk Windows
npm run build:mac    # Untuk macOS
npm run build:linux  # Untuk Linux
```

3. Copy file hasil build ke folder ini

### Opsi 2: Download dari GitHub Releases

1. Buka halaman Releases repository
2. Download file executable dari release terbaru
3. Copy ke folder ini

## Catatan

- File executable TIDAK disimpan di repository karena terlalu besar
- Build secara lokal atau download dari GitHub Releases
- Pastikan file executable sesuai dengan sistem operasi target
