# 🔐 Protokol Write-Only Kredensial Dapodik

Dokumen ini menjelaskan kontrak penulisan kredensial di `DapodikConfig`
(token Web Service, `cfAccessClientId`, `cfAccessClientSecret`): bagaimana
klien (form dashboard dan API) menandai "nilai tidak diubah" vs "set nilai
baru", bagaimana backend membedakannya, dan jaminan keamanan yang lahir
darinya.

Sumber implementasi:

- `src/lib/dapodik-sync.ts` — `saveDapodikConfig()` + `getDapodikClient()`
- `src/app/api/dapodik/config/route.ts` — parsing body POST
- `src/lib/encryption.ts` — AES-256-GCM (`encrypt` / `decrypt` / `isEncrypted`)
- `src/components/dashboard/modules/dapodik-manager.tsx` — form dashboard
- Test: `src/lib/__tests__/dapodik-config-encryption.test.ts` (unit) dan
  `e2e/dapodik-config-cf-access.spec.ts` (e2e)

---

## Latar belakang: dua bug yang memotivasi protokol ini

Kredensial sensitif tidak boleh dikirim balik ke browser setelah tersimpan.
Konsekuensinya, form tidak pernah "mengetahui" nilai lama — kolomnya selalu
kosong saat dibuka. Tanpa kontrak yang jelas, dua kelas bug muncul:

1. **Wipe diam-diam** — simpan form dengan kolom kosong menimpa nilai DB
   dengan `null`. Sebelum field CF Access ada di UI, setiap kali admin
   menyimpan konfigurasi, `cfAccessClientSecret` yang di-set via API
   langsung ikut terhapus tanpa pesan error.
2. **Enkripsi ganda** — fallback mengambil nilai lama dari DB (sudah berupa
   ciphertext) lalu mengenkripsinya lagi. Dekripsi satu kali di
   `getDapodikClient()` menghasilkan ciphertext, bukan plaintext, sehingga
   Web Service Dapodik menolak autentikasi.

Keduanya diperbaiki dengan satu kontrak yang sama untuk ketiga field.

---

## Kontrak: tiga keadaan per field

| Keadaan field pada `POST /api/dapodik/config` | Arti | Perilaku backend |
| --- | --- | --- |
| Dikirim berisi nilai | "Set nilai baru" | Normalisasi, enkripsi bila `DAPODIK_ENCRYPTION_KEY` ada, simpan |
| Dikirim kosong (`""`) | Ketentuan per field (lihat di bawah) | Token & secret: pertahankan DB · Client ID: hapus |
| Tidak dikirim (`undefined`) | "Jangan sentuh" | Pertahankan nilai DB |

Ketentuan per field saat dikirim kosong:

- **`token`** — kosong berarti *pertahankan* (write-only penuh). Konvensi
  tertua, dipakai sejak form token ada.
- **`cfAccessClientSecret`** — kosong berarti *pertahankan* (write-only,
  konsisten dengan token). Menghapus secret dilakukan lewat API dengan
  mengirim nilai kosong **beserta** penanda eksplisit — lihat catatan di
  bawah.
- **`cfAccessClientId`** — kosong berarti *hapus*. Bukan data rahasia
  (ditampilkan penuh di form), jadi tidak perlu write-only; fallback
  mempertahankan nilai lama justru menyulitkan penghapusan.

> **Mengapa Client ID dan secret berbeda?** Client ID adalah pengenal
> publik pasangan service token — aman ditampilkan. Secret rahasianya —
> write-only mencegah kehilangan kredensial karena lupa mengisi ulang
> kolom yang memang selalu kosong.

### Contoh body API

```jsonc
// Simpan konfigurasi, token & secret lama tetap dipakai (tidak dikirim):
{ "npsn": "40313912", "host": "localhost", "port": 5774, "protocol": "http" }

// Rotasi secret + ganti Client ID:
{ "npsn": "40313912", "host": "localhost", "port": 5774,
  "cfAccessClientId": "client.baru.access",
  "cfAccessClientSecret": "rahasia-baru" }

// Hapus Client ID tanpa menyentuh secret:
{ "npsn": "40313912", "host": "localhost", "port": 5774,
  "cfAccessClientId": "" }
```

---

## Implementasi backend

`saveDapodikConfig()` (ringkas):

```ts
// Token: form selalu plaintext; fallback DB bisa berupa ciphertext.
const tokenFromRequest = normalize(data.token);
const rawToken = tokenFromRequest || existing?.token || null;
const tokenToSave =
  encryptionKey && (tokenFromRequest || !isEncrypted(rawToken))
    ? encrypt(rawToken)
    : rawToken;

// Secret CF Access: pola identik dengan token (anti-wipe + anti-double-encrypt).
const cfSecretFromRequest = normalize(data.cfAccessClientSecret);
const rawCfSecret = cfSecretFromRequest || existing?.cfAccessClientSecret || null;
const cfSecretToSave =
  rawCfSecret && encryptionKey && (cfSecretFromRequest || !isEncrypted(rawCfSecret))
    ? encrypt(rawCfSecret)
    : rawCfSecret;

// Client ID: dikirim (termasuk kosong) = set/hapus; tidak dikirim = pertahankan.
const cfClientIdToSave =
  data.cfAccessClientId !== undefined
    ? normalize(data.cfAccessClientId)
    : existing?.cfAccessClientId ?? null;
```

Dua invarian yang dijaga:

1. **Hanya plaintext yang dienkripsi.** Guard `isEncrypted()` (base64
   iv+tag+ciphertext ≥ 33 byte) memastikan ciphertext fallback diteruskan
   apa adanya — dekripsi sekali di `getDapodikClient()` selalu menghasilkan
   plaintext asli.
2. **`getDapodikClient()` mendekripsi tepat sekali**, dengan self-heal untuk
   data legacy: token/secret lama yang belum terenkripsi dienkripsikan ke DB
   saat pertama kali dibaca, lalu dipakai dalam bentuk plaintext.

### Semantik di route handler

Route memakai `in` operator agar `undefined` (absen) tidak tertukar dengan
`""` (kosong):

```ts
cfAccessClientId:
  "cfAccessClientId" in body
    ? cfAccessClientId ? String(cfAccessClientId).trim() : null
    : undefined, // absen → saveDapodikConfig mempertahankan DB
```

---

## Perilaku form dashboard

Form (`dapodik-manager.tsx`) mengikuti kontrak ini secara eksplisit:

- Token dan secret **selalu dikosongkan setelah muat** — kolom kosong berarti
  "tidak diubah", bukan "hapus".
- Secret hanya ikut dikirim **bila diisi** (`...(v ? { cfAccessClientSecret: v } : {})`).
- Client ID **selalu dikirim** (termasuk kosong) supaya mengosongkannya
  benar-benar menghapus.
- Setelah simpan sukses dengan secret baru: field dikosongkan kembali dan
  hint mask diperbarui segera, tanpa menunggu reload halaman.
- Secret tersimpan hanya tampil sebagai **mask** (`xxxx****yyyy`) dari
  `getDapodikConfig()` — plaintext tidak pernah meninggalkan server.

---

## Enkripsi at rest

Semua kredensial dienkripsi AES-256-GCM sebelum masuk DB bila
`DAPODIK_ENCRYPTION_KEY` tersedia (hex 64 char = kunci 32 byte):

- Format tersimpan: `base64(IV 16B + authTag 16B + ciphertext)`.
- Tanpa key (mis. dev lokal tanpa key): nilai disimpan plaintext —
  fitur tetap jalan, hanya tanpa enkripsi at rest.
- Key salah/kunci berganti: dekripsi gagal di `getDapodikClient()` →
  **fallback tanpa crash** memakai nilai mentah, dan DB tidak ditulis ulang.
- Generate key:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## Jaminan & pengujian

| Jaminan | Unit test | E2E |
| --- | --- | --- |
| Plaintext form → tersimpan terenkripsi, dekripsi sekali = asli | ✅ | ✅ |
| Fallback ciphertext **tidak** dienkripsi ulang (double-encrypt) | ✅ | — |
| Simpan tanpa secret → secret DB **tidak ter-wipe** | ✅ | ✅ |
| Rotasi secret baru menggantikan yang lama | ✅ | ✅ |
| Client ID dikirim kosong → dihapus; secret tetap utuh | ✅ | ✅ |
| Client ID absen → dipertahankan | ✅ | — |
| Secret tidak pernah dikirim balik ke browser (hanya mask) | — | ✅ |
| Legacy plaintext → self-heal terenkripsi saat dibaca | ✅ | — |
| Key salah → fallback tanpa crash, DB tidak berubah | ✅ | — |

Jalankan verifikasi:

```bash
npx vitest run src/lib/__tests__/dapodik-config-encryption.test.ts
bun run test:e2e:local dapodik-config-cf-access.spec.ts
```

---

## Ringkasan untuk kontributor

Saat menambah field kredensial baru di `DapodikConfig`:

1. Tentukan sifatnya: **rahasia** (write-only, kosong = pertahankan) atau
   **pengenal** (kosong = hapus).
2. Terapkan pola fallback + guard `isEncrypted()` di `saveDapodikConfig()`.
3. Enkripsi sebelum simpan bila `DAPODIK_ENCRYPTION_KEY` ada.
4. Di form: selalu kosongkan setelah muat; kirim hanya bila diisi (untuk
   field rahasia) atau selalu kirim (untuk pengenal).
5. Tambahkan kasusnya ke tabel pengujian di atas.
