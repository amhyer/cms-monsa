# AGENTS.md — Non-Obvious Learnings

## Playwright Testing

- **`getByRole("alert")` fails on `<p role="alert">`**: Playwright's accessible-name matching doesn't work reliably with `<p>` elements that have `role="alert"`. Use `locator("p[role='alert']", { hasText: "..." })` instead. The accessibility tree WILL show the alerts — the issue is in Playwright's name computation, not the DOM.

- **Tailwind v4 dark mode colors use `oklch()`, not `rgb()`**: When testing dark mode backgrounds in e2e specs, don't assert `rgb()` format. Check `color-scheme: dark` CSS property, or parse `oklch()` lightness value (`< 0.3` = dark). Existing specs that check `rgb()` will fail silently or throw.

- **E2E timeout from dev server warmup**: Under heavy load (repeated Playwright runs), Next.js Turbopack can leave pages stuck on "Memuat…" (loading state) — the page never hydrates and interactive elements never appear. This is a pre-existing infrastructure issue, not a code bug. Kill the dev server and restart if tests hang.

## ThemeToggle Mobile Visibility — SUDAH DIPERBAIKI

> **Catatan (review 2026-09-18):** bagian ini dulu mendeskripsikan bug nyata
> (`ThemeToggle` memakai `hidden sm:inline-flex` sehingga tak terlihat di bawah
> 640px, dan sheet mobile tidak punya toggle sama sekali). **Bug itu sudah
> diperbaiki.** `site-header.tsx:162` (desktop), `site-header.tsx:239` (sheet
> mobile), dan `dashboard/layout.tsx:393` kini semuanya memakai `inline-flex`
> tanpa `hidden`. Bagian ini dipertahankan sebagai catatan riwayat — jangan
> dipercaya sebagai keadaan kode saat ini.

## Client IP & Rate Limiting (review 2026-09-18, temuan M1)

- **`getClientIp()` di `src/lib/rate-limit.ts` adalah kunci SEMUA bucket rate
  limit** — lockout login, form publik, anti-scraper. Urutan kepercayaannya:
  `x-vercel-forwarded-for` (hanya saat `VERCEL=1`) → `x-real-ip` → entri
  `x-forwarded-for` ke-N **dari kanan** (`TRUSTED_PROXY_HOPS`, default 1).
- Jangan "memperbaiki" ini menjadi mengambil entri XFF paling kiri. Entri kiri
  adalah nilai kiriman klien dan bebas dipalsukan — di Vercel edge *menambahkan*
  IP asli ke rantai, bukan menimpanya.
- Self-host aman karena `Caddyfile` memakai `header_up X-Real-IP {remote_host}`
  yang **menimpa** header kiriman klien. Bila nanti menambahkan CDN di depan
  Caddy, set `TRUSTED_PROXY_HOPS=2` dan pastikan Caddy tidak lagi menimpa XFF.
- **Fallback in-memory rate limiter punya batas ukuran** (`MAX_ENTRIES` per Map
  + sapu berkala). Jangan menghapus `sweepExpired`/`capSize`: tanpa keduanya
  Map tumbuh tanpa batas dan bisa dipicu OOM dengan merotasi header IP palsu.

## Pagar Pengaman Arsip Dapodik (review 2026-09-18, temuan H2)

- `archiveDapodikUnlisted()` di `src/lib/dapodik-sync.ts` punya DUA pagar:
  daftar kosong selalu ditolak, dan arsip >10% data aktif ditolak kecuali
  `force:true`. Keduanya melempar `ArchiveSafetyError` → HTTP **409** (bukan
  502) agar operator tidak menganggapnya kegagalan koneksi lalu retry buta.
- Pagar ini HANYA ada di endpoint standalone `/api/dapodik/archive`. Jalur
  arsip di dalam `applyDapodikPayload` **sengaja tidak dipagari rasio** —
  test `dapodik-sync-transaction.test.ts` ("memakai updateMany … untuk
  pengarsipan") mengharapkan 50 dari 50 siswa lama terarsip saat payload
  hanya memuat 5 siswa baru. Menambah pagar rasio di sana akan mematahkan
  test itu dan memang tidak sesuai semantiknya.

## Node.js Version — RUNTIME vs TEST SUITE BEDA

Ada dua angka Node yang berbeda di repo ini, dan mengacaukannya menyesatkan:

| Kebutuhan | Node | Bukti |
|---|---|---|
| **Build + runtime aplikasi** | **≥ 20.9** | `Dockerfile` memakai `node:20-alpine` untuk stage deps/builder/runner, dan check "Docker build, boot smoke" di `main` hijau. |
| **Test suite (`vitest run`)** | **≥ 22.19** | `undici@8`, `jsdom@30`, `whatwg-url@17`, `markdownlint@0.41` semuanya menolak Node 20. |
| **CI (`setup-repo` action)** | 22 | `.github/actions/setup-repo/action.yml` default `node-version: "22"`. |

Di Node 20, `vitest run` mati dengan **69 error**
`TypeError: webidl.util.markAsUncloneable is not a function` — pesan yang sama
sekali tidak menunjuk akar masalahnya. `npm install` juga memuntahkan
`EBADENGINE` untuk empat paket di atas.

**`.nvmrc` diset 22.19.0** agar kontributor yang menjalankan `nvm use`
mendapat Node yang sama dengan CI dan bisa menjalankan test suite.

**`engines.node` tetap `>=20.9.0`** — SENGAJA. Field itu mendeskripsikan
kebutuhan runtime paket, dan runtime memang jalan di Node 20 (Docker
membuktikannya). Menaikkannya ke `>=22.19.0` akan berkontradiksi dengan
image produksi self-host. Jangan "merapikan" ini tanpa sekalian menaikkan
`Dockerfile` ke `node:22-alpine` dan menguji build image-nya.

## bun.lock & `overrides` (jangan pakai `bun install` biasa lalu commit)

- `package.json` punya `overrides` untuk mem-pin `eslint-plugin-react-hooks`
  ke 7.0.1 (lihat `eslint.config.mjs`). **Setiap perubahan pada `dependencies`,
  `devDependencies`, ATAU `overrides` wajib disertai regenerate `bun.lock`.**
  CI dan Dockerfile sama-sama menjalankan `bun install --frozen-lockfile`, yang
  gagal keras dengan `error: lockfile had changes, but lockfile is frozen` bila
  keduanya tidak sinkron. Ini pernah menjatuhkan dua job sekaligus
  (Docker build + Self-host E2E) pada PR #15.
- **Regenerate dengan `bun install --lockfile-only`**, bukan `bun install`
  penuh — lebih cepat dan tidak menyentuh `node_modules`.
- **Versi bun memengaruhi hasil lockfile.** Repo ini dipakai dua versi bun:
  CI memakai `1.2.x` (`setup-repo`), Dockerfile memakai `oven/bun:1-alpine`
  (= 1.4.x terbaru). Keduanya harus menerima lockfile yang sama.
  - bun 1.4.2 menghasilkan **drift tak terkait** (mis. `ajv-keywords/ajv`
    6.12.6 → 8.20.0) dan mempertahankan `configVersion: 1`.
  - bun 1.2.23 menghasilkan diff minimal dan **menghapus** `configVersion`.
  - Lockfile hasil 1.2.23 sudah diuji diterima `--frozen-lockfile` oleh
    **kedua** versi (1.2.23 dan 1.4.2), jadi itu yang dipakai.
  - Bila nanti meng-regenerate, ulangi uji kedua versi itu sebelum commit.

## Pre-commit Hook

- **`.githooks/pre-commit` runs the FULL gate** (typecheck + lint + markdownlint + schema-sync + vitest) via `run-checks.sh`. This can take 2-5 minutes. Use `git commit --no-verify` when you've already verified tests pass. The hook delegates to `bun run hooks:check` which is the single source of truth.

## Frontend Cache Strategy

- **`home-view.tsx` defeats its own caching**: All fetch calls use `cache: "no-store"` plus `_=${Date.now()}` cache-buster. The Cache-Control headers on API routes only help CDN/proxy caches — the browser never benefits. This is intentional for now but worth noting: removing the cache-busting would make browser caching effective.

## Graphify (Knowledge Graph Tool)

- **No API key needed for code extraction**: graphify's AST extraction is pure Python (tree-sitter) — works without any API key. Only semantic extraction of docs/papers/images needs `GEMINI_API_KEY`. For inline extraction without subagents, write chunk JSON files directly using the extraction spec schema.
- **Python interpreter path**: Stored in `graphify-out/.graphify_python`. Always use `$(cat graphify-out/.graphify_python)` instead of `python3` in subsequent commands.
- **Semantic cache**: Stored in `graphify-out/.graphify_cached.json`. The `check_semantic_cache` function returns uncached files that need extraction.
- **Health check warnings**: 590 dangling-endpoint edges in graph is normal for large codebases — these are edges where one endpoint node was filtered or pruned during build. Not a corruption issue.
