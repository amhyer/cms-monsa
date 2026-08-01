# Audit Kesehatan Repository — CMS MONSA

> Tanggal audit: 2026-08-01 · Branch: `main` · Total commit: 79

## Ringkasan Eksekutif

Repository mengalami **tiga pola commit berulang** yang menandakan masalah
sistemik, bukan kesalahan sekali waktu:

| Pola berulang | Jumlah kejadian | Akar masalah |
|---|---|---|
| `fix: .env absolute path → relative` | **7+ commit** | `.env` pernah di-track di git → sandbox reset mengembalikan path absolut |
| `restore: upload route` | **11+ commit** | `src/app/api/upload/route.ts` **tidak ada di HEAD** → hilang setiap reset |
| `re-seed database` / `update db` | **8+ commit** | Database **dobel** (`db/` vs `prisma/db/`) + HEAD jauh tertinggal dari working tree |

**Akar masalah tunggal:** *HEAD sangat tertinggal dari working tree.* Dari 136
file yang di-track, **seluruhnya (136) berstatus modified**, ditambah 50 file
untracked berisi fitur-fitur baru yang belum pernah di-commit. Setiap sandbox
reset me-revert ke HEAD → fitur "menghilang" → agen memperbaikinya ulang →
dibuat commit baru yang hanya menambal gejala.

---

## 1. Temuan Detail

### 1.1 `.env` di-track (berulang kali "diperbaiki")

- `.env` di-track sejak **initial commit** (`c2590e2`).
- Muncul 7+ commit perbaikan path: `e2c3153`, `3c9d929`, `de57134`, `74062cb`,
  `3227d19`, `1414d50`, dan `1d1d513` ("PERMANENT FIX: .env auto-correct").
- **Patch gejala** ditanam di `dev.sh` & `build.sh`:
  ```bash
  if grep -q "file:/home" .env 2>/dev/null; then
      echo 'DATABASE_URL="file:./db/custom.db"' > .env
  fi
  ```
  Ini menimpa `.env` secara destruktif hanya jika mengandung string `file:/home`.
- ✅ **Sekarang sudah benar**: `.env*` di-gitignore (kecuali `.env.example`),
  dan `.env`/`.env.local` sudah staged-delete. Setelah di-commit, sandbox reset
  tidak akan pernah mengembalikan `.env` dari git lagi → pola ini berhenti.
- ✅ **Tidak ada kebocoran secret**: `git log -p -- .env` tidak mengandung
  `AUTH_SECRET` (hanya `DATABASE_URL` yang pernah di-commit).

### 1.2 Upload route "menghilang" — 11+ restore

- `src/app/api/upload/route.ts` dihapus lalu di-restore berkali-kali:
  `cdf2880`, `d0928e4`, `1932328`, `61aede3`, `b0b7eb5`, `2db921a`, `4a5c3f7`,
  `e0829e7`, `de10a88`, `61df6a1`, `6565790`, `77ef17f`.
- Commit `cdf2880` sendiri mengakui: *"was accidentally deleted by git rm"*.
- **Verifikasi saat ini:** `git cat-file -e HEAD:src/app/api/upload/route.ts`
  → **NOT in HEAD**. File hanya ada di disk sebagai untracked. Inilah kenapa
  file ini terus "hilang": setiap reset = kembali ke HEAD yang tidak memilikinya.
- File penting lain yang juga **tidak ada di HEAD**: `src/proxy.ts` (CORS!),
  seluruh API baru (`attendances/`, `payments/`, `students/`, `classes/`,
  `documents/`, `enrollments/`, `bulk/`, `csrf-token/`, `rss/`, `search/`),
  `src/i18n/`, `src/lib/csrf.ts`, `validations.ts`, `email.ts`, seluruh
  dashboard module baru, `e2e/`, `prisma/migrations/`, `vitest.config.ts`.

### 1.3 Database dobel + re-seed berulang

- **Dua file database berbeda ada di disk:**
  - `db/custom.db` — **135 KB** (Jul 29, usang)
  - `prisma/db/custom.db` — **323 KB** (Aug 1, live)
- **Kenapa dua?** Prisma me-resolve path SQLite relatif **terhadap lokasi file
  schema** (`prisma/schema.prisma`). Jadi `DATABASE_URL="file:./db/custom.db"`
  sebenarnya mengarah ke **`prisma/db/custom.db`**, bukan `db/custom.db`.
  Sementara `build.sh` menyalin `./db/.` → `$BUILD_DIR/db/` (lokasi root).
  Backup script (`backup-db.sh`) memeriksa `prisma/db` dulu lalu fallback ke
  `db/` — mengakui kebingungan ini.
- Dampak: seed dijalankan ke satu file, runtime membaca file lain, build
  mengemas file ketiga → muncul commit `re-seed database` 5×.

### 1.4 Masalah lain

| # | Temuan | Severity |
|---|---|---|
| 1 | `build.sh` punya path hardcoded `NEXTJS_PROJECT_DIR="/home/z/my-project"` — path sandbox spesifik, tidak portabel | 🔴 |
| 2 | `package-lock.json` di-add/hapus 3× — `bun.lock` adalah lockfile kanonik | 🟡 |
| 3 | `/docs/` di-gitignore → `docs/ARCHITECTURE.md` (yang disebut PROGRESS_LOG) **tidak akan pernah bisa di-commit** | 🟡 |
| 4 | `test-results/` (output Playwright) **belum** di-gitignore | 🟡 |
| 5 | 13 file `upload/pasted_image_*.png` pernah ter-track (sekarang sudah di-ignore via `/upload/`) | 🟢 sudah |
| 6 | 136 file modified + 50 untracked = **satu "super commit" raksasa** yang belum pernah dibagi logis | 🔴 |
| 7 | `.env.production` ada di disk (gitignored) — aman, tapi pastikan tak pernah di-track | 🟢 |

---

## 2. Rencana Pencegahan (agar tidak terulang)

### A. One-time cleanup (dilakukan sekali, hati-hati & berurutan)

1. **Hapus `.env*` & database dari index** (sudah staged, tinggal commit):
   ```bash
   git commit -m "chore: stop tracking .env, sqlite db, package-lock"
   ```
   (`.env`, `.env.local`, `db/custom.db`, `prisma/db/custom.db`,
   `package-lock.json` sudah ada di staged changes.)

2. **Commit semua fitur yang belum ter-commit dalam kelompok logis**
   (jangan satu commit raksasa). Contoh urutan:
   ```bash
   # fitur inti (upload route + proxy CORS)
   git add src/app/api/upload src/proxy.ts && git commit -m "feat: restore upload route + CORS proxy"
   # modul akademik baru
   git add src/app/api/{students,classes,attendances,payments} src/components/dashboard/modules/*manager.tsx
   git commit -m "feat: siswa, kelas, absensi, pembayaran"
   # keamanan
   git add src/lib/csrf*.ts src/lib/validations.ts src/app/api/csrf-token && git commit -m "feat: CSRF + Zod validation"
   # i18n, testing, docs, migrations
   git add src/i18n e2e vitest.config.ts prisma/migrations && git commit -m "feat: i18n + tests + migrations"
   git add README.md DEPLOYMENT.md PROGRESS_LOG.md && git commit -m "docs: dokumentasi"
   ```
   Setelah ini, **HEAD == working tree**. Reset sandbox tidak akan menghilangkan apa pun.

### B. Perbaikan kode yang mencegah kambuh

3. **`build.sh`**: ganti `NEXTJS_PROJECT_DIR="/home/z/my-project"` dengan
   path relatif script seperti `dev.sh`:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
   NEXTJS_PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
   ```

4. **Hapus patch auto-correct `.env`** dari `dev.sh` & `build.sh` setelah
   `.env` benar-benar tidak ter-track. `.env` yang hilang kini menghasilkan
   error yang jelas (Prisma: env var missing) daripada korup diam-diam.

5. **Standarisasi path database** — pilih **satu** lokasi kanonik:
   `prisma/db/custom.db` (yang benar menurut resolusi Prisma). Update:
   - `README.md` → jelaskan path relatif = relatif ke `prisma/`
   - `scripts/backup-db.*` → hapus fallback ganda, pakai satu path
   - `build.sh` → salin dari `prisma/db/`, bukan `db/`
   - Hapus `db/custom.db` root yang usang (setelah dipastikan backup).

6. **`.gitignore`**: tambah `/test-results/`; putuskan nasib `/docs/` —
   karena `docs/ARCHITECTURE.md` bernilai, hapus `/docs/` dari ignore agar
   dokumentasi bisa di-commit (atau pindahkan ke root seperti file .md lain).

### C. Kebiasaan kerja (mencegah pola berulang selamanya)

7. **Commit kecil & sering** — fitur selesai → langsung commit. Larang commit
   dengan judul "final: all clean" / "update db".

8. **Validasi sebelum commit** — jalankan:
   ```bash
   git status --porcelain | wc -l          # seharusnya mendekati 0 setelah commit
   git ls-files | grep -E '\.db$|^\.env'   # harus kosong
   git cat-file -e HEAD:src/app/api/upload/route.ts  # harus ada
   ```

9. **(Opsional) Git hook `pre-commit`** untuk otomasi #8 — file
   `.git/hooks/pre-commit` yang menolak commit jika: ada `.db`/`.env` yang
   di-stage, atau `src/app/api/upload/route.ts` / `src/proxy.ts` terhapus.

10. **Simpan salinan backup di luar repo** — database tidak pernah di-commit,
    jadi backup berkala via `npm run backup:db` menjadi satu-satunya jaring
    pengaman; pastikan cron aktif.

---

## 3. Status "Do / Jangan" Cepat

| Aksi | Status |
|---|---|
| Commit `.env` / database | ❌ Jangan pernah lagi |
| Commit `src/app/api/upload/route.ts`, `src/proxy.ts` | ✅ WAJIB (commit sekarang!) |
| Commit `bun.lock` | ✅ Ya (kanonik) |
| Commit `package-lock.json` | ❌ Jangan (hapus permanen) |
| Commit `docs/` | 🔶 Putuskan: un-ignore `/docs/` atau pindah ke root |
| Commit `test-results/` | ❌ Jangan (tambah ke .gitignore) |
