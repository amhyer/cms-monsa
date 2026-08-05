# Audit Keamanan Mendalam — CMS MONSA

> Tanggal audit: 2026-08-01 · Fokus: auth, session, CSRF, rate limiting, CORS, XSS, upload, email

## Ringkasan Temuan (urut severity)

| ID | Severity | Temuan | Area |
|----|----------|--------|------|
| C1 | ✅ Sudah diperbaiki² | Sanitizer HTML regex lemah di produksi (DOMParser `undefined` di Node) → potensi **stored XSS** via berita — diganti isomorphic-dompurify | `src/lib/sanitize.ts` |
| C2 | ✅ Sudah diperbaiki² | Upload memvalidasi MIME dari klien, bukan isi file → bisa upload `.html`/`.svg` → **stored XSS di domain sekolah** — kini deteksi magic bytes | `src/app/api/upload/route.ts` |
| C3 | ✅ Sudah diperbaiki² | Caddyfile `?XTransformPort=` = **open proxy ke port localhost mana pun** (SSRF/lateral) — blok telah dihapus | `Caddyfile` |
| H1 | 🟠 Tinggi | `getClientIp()` percaya `X-Forwarded-For` → **bypass rate limit** jika app diakses langsung | `src/lib/rate-limit.ts` |
| H2 | 🟠 Tinggi | Template email meng-interpolasi input user tanpa escape → **HTML injection di email admin** | `src/lib/email.ts`, `enrollments/route.ts` |
| H3 | 🟠 Tinggi | Session tidak punya expiry server-side (`exp`/`iat`), hanya cookie maxAge 7 hari | `src/lib/auth.ts` |
| H4 | 🟠 Tinggi | Endpoint mock `switch-role` aktif di produksi (tidak di-gate `NODE_ENV`) | `src/app/api/auth/switch-role/route.ts` |
| M1 | 🟡 Sedang | scrypt memakai parameter default (N=16384) < rekomendasi OWASP (N=2^17) | `src/lib/password.ts` |
| M2 | 🟡 Sedang | `PUT /api/users/[id]` terima password tanpa batas atas → DoS via scrypt | `src/app/api/users/[id]/route.ts` |
| M3 | 🟡 Sedang | `POST /api/enrollments` validasi manual, tanpa Zod, enum/length tidak dicek | `src/app/api/enrollments/route.ts` |
| M4 | 🟡 Sedang | Rate limiter in-memory: hilang saat restart/deploy; single-instance only | `src/lib/rate-limit.ts` |
| M5 | 🟡 Sedang | Brute-force lintas akun: limiter login per email+IP — satu IP bisa coba unlimited email berbeda | `src/lib/rate-limit.ts` |
| M6 | 🟢 Rendah | Login endpoint di-skip dari CSRF (login CSRF) — impact rendah | `src/lib/csrf.ts` |
| M7 | 🟢 Rendah | Upload tidak ada rate limit / kuota per-user → potensi disk exhaustion (auth-only) | `src/app/api/upload/route.ts` |
| C4 | 🟢 Aman¹ | **CORS (`src/proxy.ts`)**: audited — sound, tidak ada celah kritis | `src/proxy.ts` |

---

## Temuan Detail

### C1 — Sanitizer HTML regex (stored XSS) — ✅ SUDAH DIPERBAIKI (2026-08-02)

Diganti dengan **`isomorphic-dompurify`** (DOMPurify + jsdom di server, bundle
browser tanpa jsdom). Jalur regex (`sanitizeRegex`) dihapus total — tidak ada
lagi fallback lemah; test ditambah kasus obfuscation (nested tag, entity-encoded
`javascript:`, SVG script, style phishing).

**Bukti (terverifikasi):**
- `node -e "console.log(typeof globalThis.DOMParser)"` → **`undefined`** (Node v26.4.0).
- `package.json`: hanya `jsdom` (devDependency) — tidak ada dompurify/sanitize-html/linkedom di produksi.
- `src/lib/sanitize.ts:92`: `if (typeof globalThis.DOMParser !== "undefined")` → **selalu false di produksi** → jatuh ke `sanitizeRegex()`.
- `src/components/public/news-detail-view.tsx:246` me-render `dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}`.
- `src/lib/__tests__/sanitize.test.ts` lulus karena **jsdom menyediakan DOMParser di lingkungan test** — test menguji jalur kuat, produksi memakai jalur lemah.

**Celah regex fallback (`sanitizeRegex`):**
- Tidak menangani nested/obfuscation: `<scr<script>ipt>`, `<svg><script>`, `<img src=x onerror=...>`.
- Tidak menormalisasi entitas: `href="java&#x73;cript:alert(1)"` lolos karena regex hanya mencocokkan literal `javascript:`.
- Tidak menghapus `style` berbahaya (mis. `position:fixed` overlay phising).

**Rekomendasi:**
1. Pakai pustaka sanitizer dewasa di server: `isomorphic-dompurify` (memuat `jsdom`/`linkedom` di server) atau `sanitize-html`.
2. Jika tetap homemade: wajib sediakan DOMParser di server (`linkedom`) dan HAPUS jalur regex, atau buang `dangerouslySetInnerHTML` dan render dengan parser komponen (mis. `react-markdown`/render HTML yang sudah di-vet).

---

### C2 — Upload file: MIME klien ≠ isi file (stored XSS) — ✅ SUDAH DIPERBAIKI (2026-08-02)

Upload kini memvalidasi **magic bytes dari isi file** (`src/lib/upload.ts`,
`detectImageType`: JPEG/PNG/GIF/WebP) dan **memaksa ekstensi dari tipe
yang terdeteksi** (`IMAGE_TYPE_EXT`), bukan dari `file.name`/`file.type`
yang dikontrol attacker. HTML/SVG dengan nama `.html`/`.svg` ditolak;
tambah unit test `src/lib/__tests__/upload.test.ts`.

**Bukti:** `src/app/api/upload/route.ts`
- L.35: `ALLOWED_TYPES` (image/jpeg, png, gif, webp) divalidasi dari `file.type` — **nilai dari klien**.
- L.53: `const ext = file.name.split(".").pop()` — ekstensi dari nama file, TIDAK dicocokkan dengan tipe yang terdeteksi.
- Tidak ada cek magic bytes (PNG `\x89PNG`, JPEG `\xFF\xD8`, dst).
- Disimpan ke `public/uploads/` → disajikan statis oleh Next.js sebagai `text/html` untuk `.html`.

**Eksploitasi:** kirim multipart `filename=evil.html` dengan `Content-Type: image/png` → lolos MIME check → tersimpan `/uploads/evil.html` → dibuka admin/pengunjung → script berjalan di domain sekolah. (`nosniff` mengurangi sniffing, tapi `.html` tetap dilayani sebagai `text/html`.)

**Rekomendasi:**
1. **Deteksi tipe dari isi file** (magic bytes), lalu **paksa ekstensi dari tipe terdeteksi** — jangan dari `file.name`.
2. Hanya izinkan ekstensi whitelist: `.jpg .jpeg .png .gif .webp`.
3. Simpan di luar `public/` (mis. `uploads/private` + route download yang set `Content-Disposition: attachment;` dan `Content-Type` aman) atau set header `X-Content-Type-Options: nosniff` + `Content-Security-Policy: sandbox` pada `/uploads/*`.
4. Pertimbangkan re-encode gambar (sharp) untuk menghilangkan payload tersembunyi.

---

### C3 — Open proxy `XTransformPort` di Caddyfile — ✅ SUDAH DIPERBAIKI (2026-08-02)

Blok `@transform_port_query` telah dihapus dari `Caddyfile`; hanya `handle { reverse_proxy localhost:3000 }` yang tersisa.

**Bukti:** `Caddyfile:4-14`
```
@transform_port_query { query XTransformPort=* }
handle @transform_port_query {
    reverse_proxy localhost:{query.XTransformPort} { ... }
}
```

**Dampak:** siapa pun di internet menambahkan `?XTransformPort=<port>` → Caddy me-reverse-proxy ke **localhost:port mana pun** di mesin server. Ini backdoor debug/dev yang membuka akses ke layanan internal (mis. Redis, DB, mini-services) — klasik SSRF/lateral movement.

**Rekomendasi:** Hapus blok `@transform_port_query` dari Caddyfile produksi (atau gate hanya untuk dev). Biarkan hanya `handle { reverse_proxy localhost:3000 }`.

---

### H1 — `getClientIp()` percaya `X-Forwarded-For` (bypass rate limit)

**Bukti:** `src/lib/rate-limit.ts:47-52`
```ts
const xff = req.headers.get("x-forwarded-for");
if (xff) return xff.split(",")[0].trim();
```

**Konteks:** Di belakang Caddyfile yang benar (`header_up X-Forwarded-For {remote_host}` — menimpa, bukan menambah), nilai ini aman. **TAPI** jika app diakses langsung (port 3000 ekspos, atau proxy lain yang meneruskan header user), attacker cukup kirim header `X-Forwarded-For: 203.0.113.1` yang berubah-ubah untuk **melewati semua rate limit** (login & form) dan **lockout-account** orang lain (trial per IP palsu).

**Rekomendasi:**
1. Trust `X-Forwarded-For` **hanya jika** request datang dari trusted proxy; di Next standalone sulit dideteksi → jadikan kebijakan eksplisit: env `TRUST_PROXY=true` hanya di belakang Caddy, dan di production non-proxy jangan pernah membaca header klien.
2. Baca dari `x-real-ip` (yang di-set Caddy) sebagai preferensi, dan jangan trust XFF dari klien tanpa konfirmasi.
3. Idealnya: rate limit berbasis **akun** (per email) selain IP untuk login.

---

### H2 — HTML injection di email (contact / complaint / enrollment)

**Bukti:**
- `src/lib/email.ts:41-89`: `contactNotification(name, subject, message)` & `complaintNotification(...)` menyisipkan `${name}`, `${subject}`, `${message}` mentah ke `<div>`.
- `src/app/api/enrollments/route.ts:110-125`: template inline menyisipkan `${body.fullName}`, `${body.nisn}`, `${body.programChoice}`, `${body.previousSchool}` tanpa escape.
- Input ini dari form **publik** (tidak perlu login).

**Dampak:** pelapor bisa mengirim email ke admin berisi markup HTML (link phising, spoofing tombol "login", dsb.) — bukan XSS browser, tapi **phising/social engineering via email resmi sekolah**.

**Rekomendasi:** escape semua nilai sebelum interpolasi: `name.replace(/[&<>"']/g, ...)` atau pakai helper `escapeHtml()`. Jangan pernah menggabungkan input user ke HTML tanpa escape.

---

### H3 — Session tanpa expiry server-side

**Bukti:** `src/lib/auth.ts` — payload session hanya `{ userId, activeRole }`; tidak ada `exp`/`iat`. Expiry hanya via cookie `maxAge: 7 hari` (L.113).

**Dampak:** cookie yang dicuri tetap valid 7 hari; hanya nonaktifkan user (`isActive`) yang membatalkan. Tidak bisa "logout semua perangkat" atau sesi pendek untuk area sensitif.

**Rekomendasi:**
1. Tambahkan klaim `exp` (mis. 8 jam) & `iat` ke payload, dan tolak token yang `exp`-nya lewat di `decode()`.
2. (Opsional) rotasi `iat`/session ID saat aktivitas penting, dan bandingkan `iat` dengan versi minimum yang disimpan di DB bila perlu revoke cepat.

---

### H4 — `switch-role` mock aktif di produksi

**Bukti:** `src/app/api/auth/switch-role/route.ts` — route tidak memanggil `requireRole("SUPER_ADMIN")`; proteksi hanya di dalam `updateSessionRole()` (L.126-135 auth.ts) yang memeriksa `user.role === "SUPER_ADMIN"`. Route mengembalikan `{ role: target }` sukses walau switch sebenarnya no-op.

**Dampak:** tidak ada eskalasi privilege (aman secara fungsional), tapi endpoint mock ini sebaiknya **tidak eksis di produksi** — dan respon sukses yang menyesatkan bisa membingungkan admin (tampilan role berubah padahal server tidak).

**Rekomendasi:** gate dengan `if (process.env.NODE_ENV === "production") return 404;` dan/atau panggil `requireRole("SUPER_ADMIN")` eksplisit; kembalikan role aktual dari `getSession()` setelah update.

---

### M1 — Parameter scrypt default

`src/lib/password.ts` memakai `scryptSync(password, salt, 64)` dengan parameter default Node (N=16384, r=8, p=1). OWASP merekomendasikan N=2^17 (131072), r=8, p=1 untuk 2023+. Untuk CMS sekolah dengan low throughput, naikkan `maxmem` & `N`:
```ts
scryptSync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 128 * 1024 * 1024 })
```

**Catatan tambahan:** `scryptSync` **sinkron** — memblokir event loop selama komputasi (puluhan ms) pada request yang masuk. Untuk CMS sekolah dengan beban rendah fine, tapi di bawah *konkurensi apa pun* (termasuk single-instance yang sibuk) pertimbangkan versi async (`scrypt` dari `node:crypto/promises`) agar tidak menahan request lain.

---

### M2 — Password tanpa batas atas di update user

`src/app/api/users/[id]/route.ts:48`: `if (typeof body.password === "string" && body.password.length >= 6)` — tidak ada `.max()`. Password 10 MB → `hashPassword` menjalankan scrypt di string raksasa → DoS per-request. Tambahkan batas atas (mis. `<= 100`), idealnya pakai `updateUserSchema`.

---

### M3 — Enrollment POST tanpa Zod

`src/app/api/enrollments/route.ts` validasi manual `if (!body[field])`. `gender`, `programChoice`, `dateOfBirth` tidak divalidasi terhadap enum/format; tidak ada length cap per field → bisa menyimpan data tidak valid & bloat DB. **Rekomendasi:** buat `createEnrollmentSchema` (Zod) dengan enum `gender` (LAKI_LAKI/PEREMPUAN), `programChoice` (Zonasi/Afirmasi/Prestasi/Perpindahan Tugas), dan `.max()` per field.

---

### M4 — Rate limiter in-memory

`src/lib/rate-limit.ts` memakai `Map` in-process: counter hilang saat restart/deploy; tidak shared antar instance (tidak relevan untuk standalone single-instance, tapi dokumentasikan & waspadai bila pindah ke serverless/multi-instance). Untuk produksi multi-instance: back dengan Redis.

---

### M5 — Brute-force lintas akun (credential stuffing)

Limiter login dikunci per `email+IP` (`rate-limit.ts`). Konsekuensi: satu IP bisa mencoba **email berbeda tanpa batas** tanpa memicu lock — cocok untuk credential stuffing lintas akun. IP yang sama hanya dibatasi setelah 5 gagal *untuk email yang sama*.

**Rekomendasi:** tambahkan cap per-IP (mis. 20 percobaan per 15 menit per IP) selain per-email — mencegah scanning akun massal dari satu sumber.

### M6 — Login di-skip dari CSRF (rendah)

`src/lib/csrf.ts` me-skip `/api/auth/login` (dan complaints/contact POST). Tanpa CSRF di login, ada **login CSRF** (memaksa korban login ke akun attacker) — impact rendah untuk CMS sekolah dan endpoint sudah di-rate-limit. Opsional: tambahkan CSRF ke login juga, atau pertahankan dengan alasan double-submit sulit sebelum session ada.

### M7 — Upload tanpa rate limit/kuota

Upload hanya dibatasi `requireAuth` + ukuran 5 MB, tanpa kuota per-user/jam. Akun auth (mis. GURU) bisa mengunggah file tak terbatas → penuh disk. **Rekomendasi:** kuota harian per user (mis. 50 file / 200 MB) atau rate limit upload.

### C4 — CORS (`src/proxy.ts`) — audited, tidak ada celah kritis ✅

**Catatan koreksi:** `DEPLOYMENT.md` merujuk `src/middleware.ts` + `src/lib/cors.ts` yang **tidak ada** — handler CORS sebenarnya `src/proxy.ts` (Next 16 proxy).

**Analisis logika `handleApiCors`:**

| Kondisi | Perilaku | Penilaian |
|---|---|---|
| Tanpa header `Origin` (curl, server-to-server, same-origin nav) | Allow, tanpa header CORS | ✅ benar |
| Origin = asal request (same-origin) | Allow, tanpa header CORS | ✅ benar |
| Origin di `ALLOWED_ORIGINS` | Allow + echo `Access-Control-Allow-Origin: <origin>` + `Vary: Origin`; `OPTIONS` → 204 | ✅ benar |
| Origin tidak dikenal | **403** (defence-in-depth) | ✅ benar |
| `Access-Control-Allow-Credentials` | **Tidak pernah di-set** | ✅ bagus — cookie tidak bisa dieksfiltrasi lintas-origin |
| `Access-Control-Allow-Headers` | `Content-Type, X-CSRF-Token` | ✅ sesuai kebutuhan CSRF |

**Satu catatan kecil:** `ALLOWED_ORIGINS` default **kosong** → semua lintas-origin diblokir. Ini aman, tapi berarti fitur CORS allowlist tidak aktif kecuali di-set eksplisit. Pastikan `ALLOWED_ORIGINS` diisi hanya bila ada frontend terpisah yang butuh akses API. Karena `Access-Control-Allow-Credentials` tidak diset, endpoint lintas-origin yang diizinkan hanya berguna untuk akses publik read-only — bukan operasi terautentikasi. **Kesimpulan: sound, tanpa rekomendasi wajib.**

---

## Yang Sudah Bagus (dipertahankan)

- ✅ **HMAC-signed session cookie** dengan `timingSafeEqual`, `httpOnly`, `secure`, `sameSite=lax` di produksi.
- ✅ **DB adalah source of truth role** — cookie tak bisa eskalasi (CVE-grade defense).
- ✅ `requireRole()` hierarkis SUPER_ADMIN > OPERATOR > GURU + `canAccessClass` membatasi guru ke kelas walinya.
- ✅ CSRF double-submit diterapkan di semua route mutasi + `x-csrf-token` interceptor.
- ✅ Rate limit login (per email+IP, lock 15 menit) dan form publik (per IP).
- ✅ `validateBody()` Zod di mayoritas route; sanitasi & whitelist kategori di news.
- ✅ CSP ketat, `X-Content-Type-Options: nosniff`, `frame-ancestors` terbatas.
- ✅ Upload dengan nama acak (anti path-traversal) dan size cap 5 MB.

---

## Prioritas Perbaikan

1. **Segera** (hari ini): ~~C3 hapus `XTransformPort` di Caddyfile~~ **✅ selesai (2026-08-02)**; ~~C2 perbaiki validasi upload (magic bytes + ekstensi whitelist)~~ **✅ selesai (2026-08-02)**.
2. **Minggu ini**: ~~C1 ganti sanitizer (isomorphic-dompurify atau hapus regex)~~ **✅ selesai (2026-08-02)**; H2 escape email; H4 gate switch-role.
3. **Minggu depan**: H1 kebijakan trusted proxy; H3 `exp` di session; M1–M3 + **M5 (cap per-IP login)** hardening.
4. **Opsional**: M4 Redis, M6 CSRF login, M7 kuota upload.

> ¹ **Aman** = bukan temuan celah; hasil audit positif (CORS sudah benar). Lihat bagian C4.
> ² **Sudah diperbaiki** pada 2026-08-02 — blok `@transform_port_query` dihapus dari `Caddyfile`.
