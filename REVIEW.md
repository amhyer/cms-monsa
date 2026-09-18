# Review Kode — CMS Monsa

**Repo:** `amhyer/cms-monsa` · **Commit:** `e685594` (branch `main`)
**Tanggal review:** 18 September 2026
**Cakupan:** 641 file ter-track, ~70.500 baris TS/TSX, 104 API route, 69 file test

---

## Ringkasan Eksekutif

Ini **bukan** codebase pemula. Jejak auditnya nyata: `docs/SECURITY_AUDIT.md`, 27 dokumen
arsitektur/deployment, pre-commit gate lengkap, drift guard Prisma, `db-write-guard` untuk
mencegah dev menulis ke DB produksi, dan komentar yang mereferensikan temuan audit per-kode
(C1, C2, C3, K4/K5). Praktik keamanannya jauh di atas rata-rata proyek Next.js.

**Status gate yang saya jalankan:**

| Gate | Hasil | Catatan |
|---|---|---|
| `tsc --noEmit` | ✅ **0 error** | Bersih total |
| CI di GitHub (`main`) | ✅ success | CI, E2E, Build Jembatan |
| **Deploy database (Vercel + Neon)** | ❌ **failure** | Gagal terus sejak 13 Sep — lihat H1 |
| `eslint .` | ⚠️ 65 error | **Artefak lingkungan saya**, lihat M6 |
| `vitest run` | ⚠️ tidak jalan | Node 20 di sandbox vs butuh ≥22, lihat M5 |

Yang paling mendesak **bukan** bug kode, melainkan satu **secret GitHub yang kosong** yang
diam-diam menonaktifkan seluruh pengaman schema-drift Anda.

Prioritas perbaikan: **H1 → H2 → H3/H4 → sisanya.**

---

## Status Perbaikan (branch `fix/code-review-2026-09-18`)

| # | Temuan | Status | Catatan |
|---|---|---|---|
| H1 | `DATABASE_URL` secret kosong | ⚠️ **Sebagian — butuh aksi Anda** | Kode diperbaiki (fail-loud step + nama step diluruskan). **Secret-nya sendiri hanya bisa Anda set di GitHub Settings.** |
| H2 | Arsip Dapodik massal | ✅ **Selesai** | 2 pagar + `$transaction` + HTTP 409. 9 test baru (`dapodik-archive-guard.test.ts`). |
| H3 | CSP `'unsafe-inline'` | ⚠️ **Ditunda (sengaja)** | Bagian aman selesai (`ws:`/`wss:` kini dev-only). Nonce butuh verifikasi browser — rencana 5 langkah ada di komentar `next.config.ts`. |
| H4 | Source map publik | ✅ **Selesai** | `productionBrowserSourceMaps: false`, diverifikasi untuk prod & dev. |
| M1 | `getClientIp` spoofable | ✅ **Selesai** | `x-vercel-forwarded-for` di Vercel + hop dari kanan. 4 test baru, 1 disesuaikan. |
| M2 | Enumerasi user via timing | ✅ **Selesai** | scrypt selalu jalan (`dummyPasswordHash`). |
| M3 | `/api/search` tanpa rate limit | ✅ **Selesai** | 30/menit + bug `total` diperbaiki. |
| M4 | N+1 tanpa transaksi `students/bulk` | ✅ **Selesai** | 2N → 1 findMany + 1 transaksi. Dedup NIS. 3 test baru. |
| M5 | `engines` Node salah | ⚠️ **Dikoreksi — sebagian dibatalkan** | `.nvmrc` 22.19.0 ditambahkan. `engines` **tetap** `>=20.9.0`: Dockerfile memakai `node:20-alpine` dan build image di `main` hijau, jadi runtime memang cukup Node 20 — yang butuh ≥22 hanya test suite. Menaikkan `engines` akan berkontradiksi dengan image produksi. |
| M6 | Landmine `react-hooks@^7.0.0` | ✅ **Selesai** (+regenerate `bun.lock`) | `overrides` pin 7.0.1 → eslint **0 error** (dari 65). **Wajib** disertai regenerate `bun.lock` — lihat catatan di bawah. |
| M7 | PII siswa (NIS/NISN) publik | ⏸️ **Tidak diubah** | Keputusan kebijakan sekolah/DPO, bukan bug teknis. |
| M8 | Memory leak rate limiter | ✅ **Selesai** | Sapu berkala + `MAX_ENTRIES` + bug window in-memory. |
| M9 | CSRF bolong di 2FA | ✅ **Selesai** | Aman karena sudah ada interceptor `fetch` global. |
| L1 | `.tmp-*` 272 KB ter-commit | ⏸️ **Tidak diubah** | Commit `e597a2e` sengaja menyimpannya — keputusan Anda. |
| L2 | Bearer cron non-timing-safe | ✅ **Selesai** | Helper `bearerMatches` dipakai 4 route. |
| L3 | Token newsletter di query string | ✅ **Selesai** | Body didukung + rate limit di DELETE. |
| L4 | Komentar MIME vs kode | ✅ **Selesai** | Komentar diluruskan. |
| L5 | Skema `file:` di sanitizer | ✅ **Selesai** | Dihapus. |
| L6 | Komentar plaintext basi | ✅ **Selesai** | Diganti saat perbaikan M2. |
| L7 | `detectPdf` scan 1024 byte | ⏸️ **Tidak diubah** | Sengaja longgar untuk exporter yang menambah junk bytes. Risiko rendah. |
| L8 | `AGENTS.md` basi | ✅ **Selesai** | Ditandai riwayat + 4 bagian pembelajaran baru. |
| L9 | File komponen >1000 baris | ⏸️ **Tidak diubah** | Refactor besar, di luar cakupan. |
| L10 | `document.execCommand` deprecated | ⏸️ **Tidak diubah** | Butuh penggantian editor (Tiptap/Lexical). |

**Verifikasi setelah perbaikan:**

| Gate | Sebelum | Sesudah |
|---|---|---|
| `tsc --noEmit` | ✅ 0 error | ✅ 0 error |
| `tsc -p tsconfig.e2e.json` | ✅ 0 error | ✅ 0 error |
| `eslint .` | ❌ 65 error* | ✅ **0 error**, 4 warning (pre-existing) |
| `markdownlint-cli2` | ✅ 0 issue | ✅ 0 issue (40 file) |
| `vitest` (test non-DOM) | 774 lulus | ✅ **790 lulus** (+16 test baru) |

\* 65 error itu artefak versi plugin, bukan kondisi CI Anda — lihat M6.

Test component `.tsx` (53 test di 7 file) tidak bisa dijalankan di lingkungan
review karena butuh jsdom, dan jsdom menarik `undici@8` yang menolak Node 20.
**Jalankan `bun run check` di Node 22+ untuk konfirmasi penuh.**

> **Catatan proses (PR #15).** Klaim awal bahwa "`bun.lock` tidak perlu
> di-refresh" ternyata **salah** dan menjatuhkan dua job CI sekaligus
> (*Docker build, boot smoke & publish* dan *Self-host E2E*). Keduanya
> menjalankan `bun install --frozen-lockfile`, yang gagal keras dengan
> `error: lockfile had changes, but lockfile is frozen` / `note: overrides in
> package.json changed since bun.lock was saved`.
>
> Perbaikannya: `bun.lock` di-regenerate dengan `bun install --lockfile-only`
> memakai **bun 1.2.23** (menghasilkan diff 4 baris), lalu diuji diterima
> `--frozen-lockfile` oleh bun **1.2.23 dan 1.4.2** — karena repo ini dipakai
> dua versi bun (CI `1.2.x`, Dockerfile `oven/bun:1-alpine` = 1.4.x).
> Regenerate dengan bun 1.4.2 ditolak karena menimbulkan drift tak terkait
> (`ajv-keywords/ajv` 6.12.6 → 8.20.0). Detail lengkap di `AGENTS.md`.

---

## 🔴 HIGH

### H1. `secrets.DATABASE_URL` kosong → deploy DB gagal, dan semua guard pengaman ikut mati

**Bukti.** Workflow *Deploy database (Vercel + Neon)* gagal pada 3 run berturut-turut
(13, 15, 17 Sep). Pola step-nya identik:

```
  4   success    Setup repo (Node + Bun + install)
  5   skipped    Check schema/migrations drift        <-- if: env.DATABASE_URL != ''
  6   skipped    Check pre-deploy DB state (P3005)    <-- if: env.DATABASE_URL != ''
  7   failure    Run deploy script (migrate + seed)
```

Step 5–6 `skipped` hanya mungkin terjadi bila `env.DATABASE_URL == ''`. Artinya
`secrets.DATABASE_URL` **tidak ter-set** di GitHub. Script lalu berhenti di sini:

```bash
# scripts/deploy-vercel.sh:56
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL tidak di-set." >&2
    exit 1
fi
```

**Yang membuat ini HIGH, bukan sekadar CI merah.** Efek sampingnya tersembunyi: drift guard
dan P3005 guard dirancang sebagai proteksi pasca-insiden 2026-09-08 (drift 519 baris →
login gagal `P2022` di DB fresh). Karena keduanya `skipped`, **proteksi itu saat ini tidak
berjalan sama sekali** — sementara CI utama tetap hijau, jadi tidak ada sinyal apa pun.
Deploy berikutnya yang membawa migrasi bermasalah akan lolos tanpa terdeteksi.

**Perbaikan:**

1. Set `DATABASE_URL` (Neon *pooled*) di **Settings → Secrets and variables → Actions**.
   Tambahkan juga `DATABASE_URL_DIRECT` (non-pooler) — script sudah memakainya untuk DDL.
2. Buat kegagalan ini *loud*, bukan `exit 1` di langkah terakhir. Tambahkan step eksplisit
   sebelum guard:

   ```yaml
   - name: Pastikan secret DATABASE_URL ada
     run: |
       if [ -z "${DATABASE_URL:-}" ]; then
         echo "::error::Secret DATABASE_URL tidak di-set di repo."
         exit 1
       fi
   ```
3. Pertimbangkan memisahkan jalur fork (secret memang tidak tersedia) dari jalur `main`
   agar `main` tidak pernah "gagal senyap".

**Bonus — dokumentasi menyesatkan.** Nama step dan komentar workflow menyebut
*"migrate + seed"*, tetapi `scripts/deploy-vercel.sh` **tidak punya langkah seed** sama
sekali (hanya `prisma generate` → `migrate deploy`). Perbaiki nama step atau tambahkan
seed-nya.

---

### H2. `archiveDapodikUnlisted()` bisa menonaktifkan seluruh data siswa & guru

`src/lib/dapodik-sync.ts:979` mengarsipkan setiap record yang **tidak** muncul di daftar
kiriman jembatan — tanpa satu pun pengaman terhadap daftar kosong atau terpotong:

```ts
const pdIdSet = new Set(pesertaDidikIds.filter(Boolean));
const studentsToArchive = activeStudents
  .filter((s) => s.dapodikId && !pdIdSet.has(s.dapodikId))
  .map((s) => s.id);
// ...
data: { archivedAt, isActive: false }
```

Kirim `POST /api/dapodik/archive` dengan `{ "pesertaDidikIds": [], "gtkIds": [] }` dan
**semua siswa aktif plus semua guru ber-NUPTK/NIP langsung `isActive: false`**. Endpoint
ini memang terautentikasi (x-api-key/Bearer) dan rate-limited, jadi bukan celah eksternal —
ini **footgun integritas data**.

Risikonya nyata, bukan hipotetis: repo Anda punya branch `merge-pr9-dapodik-bridge-crash`,
artinya jembatan sudah pernah crash. Kontrak "dipanggil SETELAH semua chunk sync berhasil"
hanya hidup di komentar; tidak ada yang menegakkannya. Jembatan yang gagal di tengah jalan
lalu tetap memanggil archive = pemadaman data massal.

**Perbaikan — pagar pengaman proporsional:**

```ts
// Tolak daftar kosong sementara masih ada data aktif
if (pdIdSet.size === 0 && activeStudents.length > 0) {
  throw new Error("Refusing to archive: pesertaDidikIds kosong padahal ada siswa aktif.");
}
// Batasi radius ledak tanpa flag eksplisit
const ratio = studentsToArchive.length / Math.max(1, activeStudents.length);
if (ratio > 0.10 && !args.force) {
  throw new Error(`Refusing to archive ${studentsToArchive.length} siswa (${(ratio*100).toFixed(1)}%). Kirim force=true bila disengaja.`);
}
```

Bungkus juga dalam `$transaction` supaya archive siswa & guru atomik.

---

### H3. CSP production memakai `script-src 'unsafe-inline'` — proteksi XSS-nya nol

`next.config.ts`:

```ts
`script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
```

`'unsafe-eval'` sudah benar dibuang di production, tapi `'unsafe-inline'` tetap ada. Selama
itu ada, **CSP tidak memberi perlindungan XSS apa pun** — satu injeksi `<script>` lolos
langsung. Padahal Anda sudah berinvestasi banyak di sisi ini (sanitize-html saat *write*
dan *render*, magic-bytes upload validation), jadi CSP seharusnya jadi lapisan terakhir.

**Perbaikan:** pakai **nonce** per-request. Di Next 16, set nonce di `src/proxy.ts` dan
teruskan ke CSP header, lalu hilangkan `'unsafe-inline'` dari `script-src`. `style-src`
boleh tetap `'unsafe-inline'` (shadcn/Tailwind memang membutuhkannya) — risikonya jauh
lebih rendah.

Sekalian perbaiki: `connect-src 'self' ws: wss: https://*.sentry.io` — skema wildcard
`ws:`/`wss:` mengizinkan koneksi ke **host WebSocket mana pun**. Itu kebutuhan HMR dev;
di production seharusnya tidak ikut terbawa.

---

### H4. `productionBrowserSourceMaps: true` mempublikasikan seluruh source code

```ts
productionBrowserSourceMaps: true,   // next.config.ts
```

Source map production tersaji publik di `/_next/static/**/*.map` — siapa pun bisa
merekonstruksi struktur kode, nama fungsi, dan logika bisnis Anda. Ini kontradiktif dengan
konfigurasi Sentry di file yang sama (`hideSourceMaps: true`), dan komentar
*"Lighthouse advisory"* bukan alasan yang sepadan: source map tidak memengaruhi skor
Lighthouse.

**Perbaikan:** set `false`. Sentry tetap dapat source map via upload saat build
(`widenClientFileUpload: true` sudah aktif) tanpa mengeksposnya ke publik.

---

## 🟡 MEDIUM

### M1. `getClientIp()` mempercayai header yang bisa dipalsukan → rate limit dapat di-bypass

`src/lib/rate-limit.ts:44`:

```ts
const real = getHeader(req, "x-real-ip");
if (real) return real;
const xff = getHeader(req, "x-forwarded-for");
if (xff) return xff.split(",")[0].trim();
```

`x-real-ip` dipercaya tanpa syarat, dan `x-forwarded-for` diambil elemen **pertama** (yang
di-set klien) bukan hop tepercaya paling kanan. Semua rate limiter Anda — brute-force login,
form publik, anti-scraper — bergantung pada fungsi ini.

- **Self-host: aman.** `Caddyfile` memakai `header_up X-Real-IP {remote_host}` yang
  *menimpa* header, jadi nilai dari klien dibuang. ✅
- **Vercel: perlu Anda verifikasi.** Kalau platform *menambahkan* (bukan menimpa) nilai,
  penyerang cukup mengirim `x-real-ip: <acak>` per request untuk lolos dari seluruh batas,
  termasuk lockout 5-percobaan di login.

**Perbaikan:** baca dari header yang dijamin platform (`x-vercel-forwarded-for` di Vercel),
atau tambahkan `TRUSTED_PROXY_HOPS` dan ambil IP ke-N dari kanan. Jangan pernah percaya
`x-real-ip` mentah dari klien.

### M2. Enumerasi user via timing di `/api/auth/login`

```ts
const valid = user ? await verifyPassword(password, user.password) : false;
// Use constant-time-ish failure regardless of whether user exists.
if (!user || !valid) { ... }
```

Komentarnya mengklaim *constant-time-ish*, tapi faktanya tidak: bila email tidak terdaftar,
`verifyPassword` **tidak dipanggil sama sekali**, sehingga scrypt (N=2^17, ~100ms+ dan
~128MB memori) dilewati. Respons untuk email tidak valid kembali jauh lebih cepat →
penyerang bisa membedakan "email ada" vs "email tidak ada" dari waktu respons.

**Perbaikan:** selalu jalankan scrypt, pakai hash dummy saat user tidak ditemukan:

```ts
const DUMMY_HASH = "<hash scrypt yang di-generate sekali, disimpan sebagai konstanta>";
const valid = await verifyPassword(password, user?.password ?? DUMMY_HASH);
```

Sisanya di route ini sudah bagus — batas panjang password 1024 (mencegah DoS scrypt),
lockout per email+IP **dan** per IP untuk credential stuffing.

### M3. `/api/search` publik tanpa rate limit + 4 full table scan

Berbeda dari `/api/students/showcase` yang sudah dipagari `rateLimitPublicGet`,
`/api/search` **tidak punya pembatas apa pun** dan menjalankan 4 query `contains` paralel.
Di Prisma/Postgres, `contains` = `LIKE '%…%'` → tidak bisa pakai index → sequential scan.

```bash
while true; do curl -s "$HOST/api/search?q=a" >/dev/null; done   # DoS murah
```

**Perbaikan:** tambahkan `rateLimitPublicGet(req, 30, 60000)`, naikkan `query.length < 2`
menjadi `< 3`, dan pertimbangkan index `pg_trgm` (GIN) untuk pencarian `contains`.

Bug kecil di route yang sama: `total: items.length` menghitung array hasil merge yang sudah
dipotong, bukan total DB — kontrak responsnya menyesatkan klien.

### M4. `/api/students/bulk` — N+1 dan tanpa transaksi

`src/app/api/students/bulk/route.ts:80`. Dengan `MAX_RECORDS = 500`:

```ts
for (const v of valid) {
  const existing = await db.student.findUnique({ where: { nis: v.nis } });  // N query
  if (existing) { await db.student.update(...); } else { await db.student.create(...); }  // N query
}
```

Sampai **1000 round-trip sekuensial** ke Neon. Pada Postgres serverless lewat pooler, itu
puluhan detik — berisiko menembus batas fungsi, dan karena **tidak ada `$transaction`**
(grep: 0 kemunculan), kegagalan di tengah menyisakan import setengah jadi tanpa rollback.
Bandingkan dengan `attendances/bulk` yang **sudah** memakai transaksi — polanya tinggal
disalin.

**Perbaikan:** ambil semua siswa existing sekali (`where: { nis: { in: [...] } }`), pisahkan
jadi daftar create/update, lalu jalankan `createMany` + `upsert` di dalam `$transaction`.

Catatan tambahan: `valid.splice(valid.indexOf(v), 1)` di dalam loop = O(n²). Ganti dengan
`.filter()`.

### M5. `engines: ">=20.9.0"` salah — proyek ini sebenarnya butuh Node ≥ 22

Terverifikasi di sandbox (Node v20.20.2): `npm install` mengeluarkan `EBADENGINE` untuk
`undici@8.10.2` (butuh ≥22.19.0), `jsdom@30`, `whatwg-url@17`, `markdownlint@0.41`.
Lalu `vitest run` mati dengan **69 error**:

```
TypeError: webidl.util.markAsUncloneable is not a function
  at new CacheStorage node_modules/undici/lib/web/cache/cachestorage.js:20:17
```

Kontributor baru di Node 20 akan melihat seluruh test suite gagal dengan pesan yang sama
sekali tidak menunjuk akar masalahnya.

**Perbaikan:** tambahkan `.nvmrc` (22.19.0) agar kontributor yang menjalankan `nvm use`
mendapat Node yang sama dengan CI.

**Tetapi JANGAN naikkan `engines.node`.** Review ini awalnya merekomendasikan
`>=22.19.0`, dan itu keliru: `Dockerfile` memakai `node:20-alpine` untuk stage
deps/builder/runner dan check "Docker build, boot smoke" di `main` hijau — jadi
**build + runtime memang cukup Node 20**. Yang butuh ≥22 hanya test suite.
`engines` mendeskripsikan kebutuhan runtime paket, sehingga `>=20.9.0` sudah akurat.
Menaikkannya akan berkontradiksi dengan image produksi self-host.

Bila memang ingin menyeragamkan ke Node 22, urutannya: naikkan `Dockerfile` ke
`node:22-alpine` **dan** uji build image-nya dulu, baru sentuh `engines`.

> Koreksi ini ditemukan setelah PR dibuka — lihat "Catatan proses (PR #15)" di bawah.

### M6. `eslint-plugin-react-hooks: ^7.0.0` adalah landmine

`bun.lock` mengunci **7.0.1** → CI hijau. Tapi saya install via npm (tanpa lockfile bun) dan
dapat **7.1.1**, yang langsung menghasilkan **65 error**:

```
63  react-hooks/set-state-in-effect   error
 2  react-hooks/immutability          error
 4  @typescript-eslint/no-unused-vars warning
```

Tersebar di 30+ file, terutama `src/components/dashboard/modules/*.tsx` dan `src/hooks/`.
Ini **bukan** kerusakan saat ini — CI Anda hijau. Tapi range `^7.0.0` berarti `bun update`,
penghapusan lockfile, atau install ulang di mesin baru akan mengubah CI jadi merah massal.

**Perbaikan:** pin versi exact (`7.0.1`) atau — lebih baik — perbaiki polanya. Kebanyakan
temuan adalah `setState` sinkron di dalam `useEffect`, yang memang menyebabkan render
berjenjang; `use-mobile.ts:14` contoh paling jelas. Anda juga sudah mematikan
`react-hooks/purity` di `eslint.config.mjs`, jadi memutuskan secara sadar untuk
`set-state-in-effect` lebih baik daripada ketahuan nanti.

### M7. PII siswa di bawah umur terekspos di endpoint publik

`/api/students/showcase` mengembalikan **nama + foto + NIS + NISN** seluruh siswa aktif
tanpa autentikasi. Komentarnya menjelaskan alasannya (orang tua mencocokkan identitas),
dan memang sudah ada `rateLimitPublicGet(30, 60000)` + cache. Tapi dengan `limit` sampai
200 dan pagination penuh, seluruh roster sekolah tetap bisa dipanen dalam beberapa request.

NISN adalah identifier nasional permanen. Subjek datanya **anak di bawah umur**, yang
mendapat perlindungan khusus di **UU PDP No. 27/2022** (data anak termasuk data spesifik).

**Rekomendasi:** ini keputusan kebijakan sekolah, bukan bug teknis — tapi layak dibahas
dengan kepala sekolah/DPO. Opsi tengah: tampilkan nama + foto + kelas saja, dan buka
NIS/NISN hanya di portal orang tua yang terautentikasi. Atau kaburkan NISN
(`0012345***`).

### M8. Fallback in-memory rate limiter bocor memori

Saat Redis tidak tersedia, `rate-limit.ts` memakai empat `Map` global (`store`, `ipStore`,
`formStore`, `getStore`) yang **tidak pernah dibersihkan**. Setiap IP unik menambah entri
permanen. Di deployment Docker/self-host yang berjalan lama tanpa Redis, ini tumbuh tanpa
batas → memory leak yang berujung OOM, dan bisa dipicu sengaja.

**Perbaikan:** sapu berkala entri kedaluwarsa (`setInterval` tiap menit, atau cek umur saat
akses), atau pakai LRU berukuran tetap.

### M9. CSRF tidak konsisten di endpoint 2FA

`/api/auth/2fa/setup`, `/verify`, dan `/disable` memakai `requireAuth` tetapi **tidak**
memanggil `requireCsrf`, sementara puluhan route mutasi lain memanggilnya. Risiko praktisnya
rendah — cookie session memakai `SameSite=Lax` di production, yang sudah memblokir POST
lintas-situs, dan `2fa/disable` masih menuntut konfirmasi password.

Tapi ada dua alasan untuk tetap merapikannya: (a) di **development** cookie diset
`SameSite=None`, jadi perlindungannya hilang; (b) inkonsistensi membuat reviewer berikutnya
sulit membedakan "sengaja" dari "terlewat".

---

## 🔵 LOW / Kebersihan Repo

| # | Temuan | Lokasi |
|---|---|---|
| L1 | 272 KB CI debug dump ter-commit (`.tmp-allruns.json` 181 KB, `.tmp-runs.json`, `.tmp-jobs.json`, 2 changelog). Saya scan: **tidak ada secret bocor** ✅ — tapi ini tetap sampah di riwayat git. Commit `e597a2e` bahkan sengaja menyimpannya. | root |
| L2 | Perbandingan Bearer token memakai `!==`, bukan `timingSafeEqual`. Tidak praktis dieksploitasi lewat jaringan, tapi murah diperbaiki — dan Anda sudah memakai `timingSafeEqual` di tempat lain. | `api/cron/backup`, `cleanup-uploads`, `storage-alert`, `cron-failure` |
| L3 | Token unsubscribe dikirim via **query string** (`DELETE /api/newsletter?token=…`) → terekam di access log proxy/CDN. Pindahkan ke body. Juga tidak ada rate limit di DELETE. | `api/newsletter` |
| L4 | Komentar route mengklaim *"Content-Type diambil dari metadata tersimpan (hasil deteksi magic bytes)"*, tapi jalur **disk** di `loadUpload()` menurunkan MIME dari **ekstensi filename**. Terbatas oleh whitelist ekstensi, jadi aman — namun dokumentasi dan kode tidak cocok. | `file-storage.ts` |
| L5 | `allowedSchemes` sanitizer memuat `"file"`. Tidak perlu untuk CMS publik; buang. | `sanitize.ts:51` |
| L6 | Komentar *"Support both hashed and (legacy) plaintext stored passwords"* tidak akurat — `verifyPassword` mengembalikan `false` bila tidak ada `:`, jadi plaintext memang ditolak. Komentarnya yang harus diperbaiki. | `api/auth/login` |
| L7 | `detectPdf()` memindai 1024 byte pertama, bukan offset 0 — file polyglot bisa lolos. Risiko rendah karena disajikan `inline` sebagai `application/pdf`. | `upload.ts` |
| L8 | **`AGENTS.md` sudah basi.** Bagian "ThemeToggle Mobile Visibility" menyebut `hidden sm:inline-flex` membuat toggle tak terlihat di mobile. **Sudah diperbaiki** — kini `inline-flex`, dan ada toggle di mobile sheet (`site-header.tsx:239`). Dokumentasi yang menyesatkan lebih buruk daripada tidak ada. | `AGENTS.md` |
| L9 | File sangat besar: `settings-manager.tsx` (1069), `users-manager.tsx` (1049), `dapodik-manager.tsx` (958), `teachers-manager.tsx` (896). Kandidat pemecahan. | `components/dashboard/modules/` |
| L10 | `document.execCommand` sudah deprecated. Editor kaya teks ini akan butuh penggantian (mis. Tiptap/Lexical) cepat atau lambat. | `news-manager.tsx:76` |

---

## ✅ Yang Sudah Bagus — jangan diubah

Layak disebut eksplisit, karena ini yang membedakan codebase Anda:

**Kriptografi & sesi**
- `scrypt` dengan parameter OWASP penuh (N=2^17, r=8, p=1) + `maxmem` diset sadar, bukan default Node
- `timingSafeEqual` di verifikasi password, decode sesi, **dan** CSRF
- Cookie sesi HMAC-signed dengan `__Host-` prefix di production, `httpOnly`, `Secure`, plus expiry server-side 7 hari
- **DB adalah source of truth untuk role** — hanya `SUPER_ADMIN` yang boleh mempertahankan `activeRole` dari cookie. Ini menutup privilege escalation lewat tampering cookie dengan elegan.
- `AUTH_SECRET` **melempar error** di production bila tidak diset (bukan diam-diam fallback)
- AES-256-GCM untuk token Dapodik, dengan format `iv+authTag+ciphertext` yang benar

**Upload & output**
- Deteksi **magic bytes**, bukan `file.type` atau ekstensi — keduanya attacker-controlled
- Filename selalu di-generate server-side (timestamp-random); tidak ada path traversal
- Whitelist ekstensi ganda di `isSafeUploadFilename` (menolak `/`, `..`, panjang >128)
- `sanitize-html` dipanggil **saat write** (`api/news` POST:78, PUT:76) **dan saat render** — defense in depth yang benar
- Hanya 2 `dangerouslySetInnerHTML`, keduanya tersanitasi. Nol `eval`/`new Function`.

**Infrastruktur**
- **`db-write-guard.ts` adalah fitur standout.** Memblokir semua operasi tulis Prisma saat
  dev menunjuk ke host DB remote (Neon/RDS/Supabase/dll) — dengan escape hatch eksplisit
  `ALLOW_REMOTE_DB_WRITES=1`. Ini menyelesaikan kelas kecelakaan "salah klik di preview =
  data produksi berubah" yang jarang dipikirkan orang.
- `$executeRawUnsafe` hanya dipakai dengan **konstanta hardcoded** (`BRIDGE_COLUMN_DDL`,
  `UPLOAD_REFERENCE_SQL`) — nol injeksi SQL. Satu-satunya `$queryRaw` lain adalah `SELECT 1`
  di health check.
- Open proxy di Caddyfile sudah ditutup (temuan C3) dan komentarnya menjelaskan *mengapa*
- CORS dengan allowlist origin eksplisit + tolak 403, `Vary: Origin` diset benar
- Login: batas panjang password (anti-DoS scrypt), lockout per email+IP **dan** per-IP
  (anti credential stuffing), pesan error seragam
- `proxyClientMaxBodySize: 25mb` diset lebih besar dari batas bisnis 15 MB supaya user dapat
  pesan 400 yang jelas, bukan 500 misterius — reasoning-nya terdokumentasi
- Security headers lengkap: `nosniff`, HSTS 2 tahun + preload, `Referrer-Policy`,
  `Permissions-Policy`, `frame-ancestors` (bukan `X-Frame-Options` usang, dengan alasan dicatat)

**Proses**
- 69 file test + E2E Playwright lintas 20+ spec, termasuk `identity-no-leak.spec.ts` dan
  `csrf-header.spec.ts` — test yang menguji properti keamanan, bukan hanya happy path
- Pre-commit gate penuh (`typecheck + lint + markdownlint + schema-sync + vitest`)
- `typecheck` **benar-benar bersih** pada 70 ribu baris kode — ini langka
- 27 dokumen audit + `AGENTS.md` yang merekam pembelajaran non-obvious
- Riwayat commit deskriptif dengan referensi insiden nyata (drift 519 baris, bug refactor c92ca77)

---

## Rencana Aksi

**Minggu ini**
1. **H1** — Set `DATABASE_URL` + `DATABASE_URL_DIRECT` di GitHub Secrets. Ini satu-satunya
   yang sedang aktif merusak (guard drift nonaktif sejak 13 Sep).
2. **H2** — Tambahkan guard daftar-kosong + ambang rasio di `archiveDapodikUnlisted`.
3. **H4** — `productionBrowserSourceMaps: false`. Satu baris.
4. **M5** — `engines.node: ">=22.19.0"` + `.nvmrc`. Dua baris, menyelamatkan kontributor baru.

**Sprint berikut**
5. **H3** — CSP nonce-based, buang `'unsafe-inline'` dari `script-src`, persempit `connect-src`.
6. **M1** — Verifikasi perilaku header XFF di Vercel, perbaiki `getClientIp()`.
7. **M2** — Hash dummy untuk samakan waktu respons login.
8. **M3** — Rate limit `/api/search`.
9. **M4** — Batch + transaksi di `students/bulk` (salin pola `attendances/bulk`).

**Kapan sempat**
10. **M6** — Perbaiki pola `setState`-in-effect, lalu pertimbangkan pin exact.
11. **M7** — Diskusikan eksposur NIS/NISN dengan sekolah/DPO.
12. **M8, M9, L1–L10** — Kebersihan.

---

## Keterbatasan Review Ini

Supaya Anda bisa menilai bobot temuan di atas:

- **`vitest` tidak saya jalankan.** Sandbox hanya punya Node 20; suite mati sebelum satu pun
  test jalan (lihat M5). Saya tidak bisa mengonfirmasi 69 file test itu lulus.
- **`eslint` saya jalankan dengan dependency hasil npm**, bukan `bun.lock`. 65 error itu
  kemungkinan besar artefak versi 7.1.1 vs 7.0.1 yang di-pin (M6), **bukan** kondisi CI Anda
  yang sebenarnya hijau.
- **Perilaku header `x-forwarded-for` di Vercel (M1) belum saya verifikasi empiris.** Perlu
  dites langsung di deployment Anda.
- **Log mentah CI tidak bisa saya unduh** (endpoint logs GitHub butuh autentikasi). Diagnosis
  H1 saya simpulkan dari pola step conclusion + pembacaan script — sangat kuat, tapi log
  aslinya akan mengonfirmasi 100%.
- **Belum dites runtime.** Tidak ada build production atau uji penetrasi; ini review statis
  plus inspeksi CI.
- Saya membaca ~40 file secara penuh dan memindai 104 route secara sistematis. Komponen UI
  (28.500 baris di `src/components/`) hanya saya periksa lewat pemindaian pola, bukan
  baris per baris.
