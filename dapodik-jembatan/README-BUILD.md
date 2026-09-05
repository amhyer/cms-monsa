# Membangun Jembatan Dapodik .exe

Panduan untuk membangun file `.exe` dari `jembatan.mjs` sehingga bisa dijalankan tanpa install Node.js.

## Prasyarat

- Node.js 18+ terinstall
- npm atau yarn

## Langkah Build

### 1. Install Dependencies

```bash
cd builder
npm install
```

### 2. Build untuk Windows (.exe)

```bash
npm run build:win
```

File `.exe` akan muncul di folder `dist/Jembatan-Dapodik.exe`

### 3. Build untuk Semua Platform

```bash
npm run build:all
```

Akan menghasilkan:
- `dist/Jembatan-Dapodik.exe` - untuk Windows
- `dist/Jembatan-Dapodik-macos` - untuk macOS
- `dist/Jembatan-Dapodik-linux` - untuk Linux

## Cara Pakai File .exe

### Untuk Operator Sekolah

1. **Download** file `Jembatan-Dapodik.exe`
2. **Double-click** untuk menjalankan (tidak perlu install Node.js!)
3. Browser akan otomatis terbuka di `http://localhost:3847`
4. Ikuti langkah di antarmuka web

### Persiapan di Dapodik

1. Buka aplikasi Dapodik
2. Login sebagai admin
3. Buka **Pengaturan** → **Web Service Lokal** → **Web Service**
4. Klik **Tambah**
5. Isi:
   - Nama Aplikasi: `Jembatan-Dapodik`
   - IP Address: `localhost`
6. Klik **Simpan**
7. **Salin Token** yang generated

### Setup di Aplikasi Jembatan

1. Buka aplikasi Jembatan di browser
2. Isi form:
   - **URL CMS**: `https://[domain-sekolah].vercel.app` atau URL production Anda
   - **Kunci Pairing CMS**: Dari dashboard CMS → Penarikan Dapodik → Jembatan PC Sekolah
   - **NPSN**: Nomor NPSN sekolah
   - **Token Web Service Dapodik**: Token yang sudah disalin dari Dapodik
   - **Host Dapodik**: `localhost` (default)
   - **Port Dapodik**: `5774` (default)
3. Klik **Simpan**
4. Klik **Tes Dapodik** untuk memastikan koneksi berhasil
5. Klik **Tarik & Kirim** untuk sinkronisasi data

## Troubleshooting

### Error "Port 3847 sedang dipakai"

Ada proses jembatan lain yang sedang berjalan. Tutup aplikasi jembatan yang lama, atau cek task manager untuk proses Node.js yang masih aktif.

### Error koneksi ke Dapodik

1. Pastikan aplikasi Dapodik sudah terbuka
2. Pastikan Web Service sudah diaktifkan di Dapodik
3. Cek apakah port 5774 bisa diakses (cek di Task Manager → Services)

### Error koneksi ke CMS

1. Pastikan URL CMS sudah benar (include `https://`)
2. Pastikan Kunci Pairing sudah benar
3. Cek apakah CMS/Vercel sudah ter-deploy dan online

## Build dengan GitHub Actions (Otomatis)

Untuk build otomatis setiap ada update, bisa gunakan GitHub Actions. Contoh workflow:

```yaml
# .github/workflows/build-jembatan.yml
name: Build Jembatan Dapodik

on:
  push:
    paths:
      - 'dapodik-jembatan/jembatan.mjs'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: cd dapodik-jembatan/builder && npm install
      - run: npm run build:all
      - uses: actions/upload-artifact@v4
        with:
          name: jembatan-dapodik-binaries
          path: dapodik-jembatan/dist/
```

## Lisensi

MIT License - sama dengan project utama CMS MONSA
