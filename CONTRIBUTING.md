# Contributing — CMS MONSA

> Panduan konsolidasi untuk kontributor: **gate validasi** (pre-commit &
> pre-push) dan **alur E2E** (Playwright + triage) dalam satu tempat. Detail
> kanonik tetap di [README.md](README.md) (*Pre-commit Hook* & *E2E
> Troubleshooting*); panduan menjalankan project dari nol (instalasi, env,
> database, dev, deploy, backup) ada di [docs/RUNNING.md](docs/RUNNING.md).

## 1. Alur Kontribusi Ringkas

1. Buat branch/fork dari `main`.
2. Ubah kode, lalu validasi lokal: `bun run check`.
3. Bila menyentuh halaman/API: `bun run test:e2e` (detail §3).
4. Push & buka PR — CI menjalankan gate + e2e yang sama persis.

## 2. Gate Validasi (pre-commit & pre-push)

Satu sumber kebenaran: [.githooks/run-checks.sh](.githooks/run-checks.sh),
dipakai identik oleh `git commit`, `bun run hooks:check`, dan job CI
`hooks-gate`
([.github/workflows/hooks-gate.yml](.github/workflows/hooks-gate.yml)) — tiga
jalur tidak bisa drift.

### Instalasi & dry-run

```bash
bun run hooks:install         # aktifkan hook (sekali per clone)
bun run hooks:check           # gate PENUH: guard → typecheck → lint → lint:md → check:schema → vitest
bun run hooks:check -- --quick          # ringan: guard + lint seluruh repo (tanpa typecheck/vitest)
bun run hooks:check -- --staged         # hanya file JS/TS ter-stage (+ daftar non-JS transparan)
bun run hooks:check -- --json           # SATU baris JSON untuk CI/bot (schema: README → Output JSON)
bun run hooks:check -- --staged-push    # (internal pre-push; butuh HOOKS_PUSH_FILES) file commit yang di-push
```

### Guard repository

Gagal seketika sebelum validasi kode: file `.db*` / `.env*` ter-stage
(kecuali [.env.example](.env.example)) — mencegah database/secret ter-commit.
Blokir = commit ditolak dengan pesan jelas.

### Pre-push

Default: `--quick` (guard + lint seluruh repo); push tag dilewati. Mode via
env:

| Perintah | Efek |
|----------|------|
| `git push` | sanity check ringan (`--quick`) |
| `PUSH_GATE=full git push` | gate PENUH (typecheck + lint + lint:md + check:schema + vitest) |
| `PUSH_GATE=staged git push` | lint hanya file yang disentuh commit yang di-push |
| `git config pre-push.gate full\|staged` | default persisten per clone (env `PUSH_GATE` tetap menang) |
| `PUSH_JSON=1 git push` | stdout = SATU baris JSON gate (detail manusia ke stderr) |

### Escape hatch (tidak disarankan)

```bash
git commit --no-verify
git push --no-verify
```

### CI mirror

Job `hooks-gate` (reusable workflow) menjalankan `bun run hooks:check -- --json`
di setiap PR & push main dan merender hasilnya ke step summary — gate lokal
dan CI selalu identik.

## 3. E2E (Playwright)

### Alur `bun run test:e2e`

Wrapper [scripts/run-e2e.ts](scripts/run-e2e.ts): **tentukan server target →
panaskan rute → `playwright test` → bersihkan server & tulis artifact log**.

### Warm-up pragma (cold-compile)

Dev mode Next.js meng-compile route **saat pertama diakses** — mutasi
`DELETE`/`PUT` bisa stall 5–10 detik. Wrapper memanaskan rute sebelum suite
([e2e/warmup.ts](e2e/warmup.ts)): rute default + rute dari pragma `// warmup:`
di tiap spec + rute API dinamis. Pragma bisa path-only atau method-spesifik:

```ts
// e2e/news-crud.spec.ts — path-only
// warmup: /api/news /api/auth/login

// e2e/login.spec.ts — method-spesifik
// warmup: POST /api/auth/login POST /api/auth/logout
```

Spec yang memutasi API tanpa pragma menggagalkan CI
(`bun run check:warmup-declarations`). Panaskan manual tanpa suite:
`bun run e2e:warmup` (tambahkan `--if-up` bila hanya ingin memanaskan server
yang sedang hidup).

### `--if-up` (reuse dev server)

`bun run test:e2e -- --if-up` memakai server yang **sudah berjalan**; tanpa
server, suite dilewati dengan exit 0. Tail kegagalan di reuse mode diambil
dari `E2E_SERVER_LOG` (bila menunjuk log dev yang hidup) atau
`.zscripts/dev.log` (log `.zscripts/dev.sh`).

### Triage kegagalan

Saat suite gagal, wrapper **otomatis** menjalankan
[scripts/triage-e2e.ts](scripts/triage-e2e.ts) — verdict di konsol + step
summary + artifact. Manual:

```bash
bun run triage:e2e             # verdict manusia
bun run triage:e2e -- --json   # SATU baris JSON untuk CI/bot
```

Verdict: `warmup-failed` (section wrapper terlalu kecil — warm-up gagal
 diam-diam, menang atas counts) | `cold-compile` (stall mutasi ≥ 5s —
 cache-flake, rerun dulu) | `network` (DNS/connection) | `assertion` |
 `clean`.

### Alur kegagalan di CI (ringkas)

- **Artifact**: `server-log` (merged wrapper + server + `*.err`, di-upload
  tiap run, retention 30 hari) + `playwright-report` (gagal saja, 7 hari);
  nama `-prod` di workflow produksi.
- **Step summary**: tail log server + laporan triage manusia +
  `### 🔎 Triage payload (JSON — untuk bot/CI)` (payload `--json` mentah).
- **PR comment**: sticky (di-update di tempat, duplikat dibersihkan) berisi
  verdict + temuan per-kategori (dipotong 5) + warning warm-up + link ke
  report/log/run.
- **Flag cache-flake**: verdict `cold-compile` **atau** `warmup-failed` →
  step `Flag cache-flake (cold-compile / warmup-failed)` gagal dengan
  **exit 42** + pesan `::error::` khas — rerun karena cache dingin terlihat
  terpisah dari kegagalan nyata.

## 4. Referensi

- [README.md](README.md) — fitur & dokumentasi kanonik (Pre-commit Hook,
  E2E Troubleshooting, env knobs E2E, contoh konsumsi `triage:e2e -- --json`
  di GitHub Actions).
- [docs/RUNNING.md](docs/RUNNING.md) — panduan menjalankan project dari nol
  (termasuk §12 E2E Troubleshooting).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arsitektur internal.
- [PROGRESS_LOG.md](PROGRESS_LOG.md) — log perkembangan proyek.
