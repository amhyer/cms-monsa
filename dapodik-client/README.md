# dapodik-client

Client library PHP + TypeScript untuk mengambil data dari Dapodik Web Service.

## Fitur

- Ambil data sekolah, siswa (Peserta Didik), guru (GTK), dan rombongan belajar
- Auth via Bearer token
- Tipe data lengkap (TypeScript)
- Support HTTP dan HTTPS (dengan SSL verification)

## Struktur Folder

```
dapodik-client/
├── src/
│   ├── DapodikClient.php       # Library PHP
│   └── DapodikClient.ts        # Library TypeScript
├── config.example.php          # Contoh konfigurasi PHP
├── config.example.ts           # Contoh konfigurasi TypeScript
├── example.php                 # Contoh penggunaan PHP
├── example.ts                  # Contoh penggunaan TypeScript
├── tsconfig.json
├── package.json
├── .gitignore
└── README.md
```

## Instalasi

### PHP

Tidak perlu instalasi khusus. Copy `src/DapodikClient.php` ke project Anda.

### TypeScript

```bash
npm install
npm run build
```

**Requirement:** Node.js 18+ (native fetch)

## Konfigurasi

Copy file konfigurasi example dan isi dengan data sekolah Anda:

```bash
cp config.example.php config.php
cp config.example.ts config.ts
```

**Penting:** `config.php` dan `config.ts` sudah di-gitignore. Jangan pernah commit file ini ke repository.

## Penggunaan

### PHP

```php
<?php
require_once __DIR__ . '/src/DapodikClient.php';
$config = require 'config.php';

$client = new DapodikClient(
    $config['npsn'],
    $config['token'],
    $config['host'],
    $config['port'],
    $config['protocol'] ?? 'http'
);

// Test koneksi
if ($client->testConnection()) {
    echo "Koneksi berhasil!\n";
}

// Ambil semua data
$allData = $client->getAllData();
print_r($allData['sekolah']);
```

### TypeScript

```typescript
import { DapodikClient } from './src/DapodikClient';
import { loadConfig } from './config';

const config = loadConfig();
const client = new DapodikClient(config);

const sekolah = await client.getSekolah();
console.log(sekolah.nama);
```

## Keamanan

**WAJIB baca sebelum production:**

Jika Web Service Dapodik diakses melalui internet atau jaringan publik, **WAJIB** gunakan HTTPS atau tunnel terenkripsi. Jangan pernah mengirim token autentikasi dan data sensitif (NISN, alamat, nama orang tua) melalui koneksi HTTP tanpa enkripsi.

```php
// PHP — gunakan HTTPS untuk akses remote
$client = new DapodikClient($npsn, $token, $host, $port, 'https');
```

```typescript
// TypeScript — gunakan HTTPS untuk akses remote
const client = new DapodikClient({ ...config, protocol: 'https' });
```

## Lisensi

MIT
