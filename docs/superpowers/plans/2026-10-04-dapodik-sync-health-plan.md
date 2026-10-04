# Implementation Plan — Dapodik Sync Health & Alerting

- **Tanggal**: 2026-10-04
- **Spec**: [2026-10-04-dapodik-sync-health-design.md](../specs/2026-10-04-dapodik-sync-health-design.md)
- **Metode**: TDD per fase — test merah dulu bila praktis, implementasi, verifikasi eksplisit, commit kecil per fase.
- **Gerbang**: `bun run check` (typecheck + eslint + markdownlint + mutation-handler guard + vitest) harus hijau sebelum tiap commit; `lint:md` wajib untuk perubahan dokumen.

## Fakta repo yang sudah diverifikasi (dasar plan)

- `applyDapodikPayload(payload, mode, opts?)` ada di
  [src/lib/dapodik-sync/plan.ts](../../../src/lib/dapodik-sync/plan.ts); `runSync`
  (jalur sync/pull/auto) dan route `ingest` memanggilnya. `mode` bertipe
  `"dry-run" | "commit"`, `opts.userId` tersedia.
- Cron berjalan via **GET + `Authorization: Bearer $CRON_SECRET`**
  ([src/app/api/cron/storage-alert/route.ts](../../../src/app/api/cron/storage-alert/route.ts));
  self-host memakai runner `scripts/cron-job.sh <nama> <path>` di
  [docker-compose.cron.yml](../../../docker-compose.cron.yml) (entri crontab
  busybox, 1 ulangan + log body).
- Mailer sudah ada: [src/lib/email.ts](../../../src/lib/email.ts) —
  `sendEmail(options): Promise<boolean>` (+ `emailTemplates`).
- Beranda dashboard: [src/app/dashboard/page.tsx](../../../src/app/dashboard/page.tsx)
  → `Overview` di
  [src/components/dashboard/modules/overview.tsx](../../../src/components/dashboard/modules/overview.tsx).
- Modul Dapodik: [src/components/dashboard/modules/dapodik-manager/](../../../src/components/dashboard/modules/dapodik-manager/)
  (`index.tsx`, `dapodik-summary-cards.tsx`, `dapodik-config-form.tsx`, `types.ts`, …).
- E2E TIDAK memakai Prisma langsung — fixture datang dari
  [prisma/seed-e2e.ts](../../../prisma/seed-e2e.ts) (idempoten, guard `E2E_SEED=1`).
- Notifikasi: [src/lib/notifications.ts](../../../src/lib/notifications.ts) —
  `notifyAdmin(message)` saat ini WhatsApp + Telegram, return
  `{ whatsapp, telegram }`.

## Prasyarat lingkungan

- DB dev PostgreSQL hidup (docker compose dev / Neon branch dev).
- `.env`: `CRON_SECRET` tersedia untuk uji cron lokal; `SMTP_*` + `ADMIN_EMAIL`
  opsional (email channel teruji lewat mock, tanpa SMTP nyata).
- Bun + `bun install` sudah jalan (postinstall generate Prisma client).

---

## Fase 1 — Schema & migrasi Prisma

**File**: [prisma/schema.prisma](../../../prisma/schema.prisma) (setelah `DapodikConfig`).

Tambahkan dua model (persis spec):

```prisma
model DapodikSyncLog {
  id           String   @id @default(cuid())
  mode         String // AUTO | MANUAL | INGEST | ARCHIVE
  dataType     String? // untuk INGEST: sekolah|gtk|rombel|peserta_didik|archive
  status       String // OK | ERROR
  actor        String? // userId | "bridge" | "scheduler" | "cron"
  sekolahCount Int      @default(0)
  gtkCount     Int      @default(0)
  rombelCount  Int      @default(0)
  siswaCount   Int      @default(0)
  durationMs   Int?
  error        String? // tersanitasi, maks 500 char
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([status, createdAt])
}

model DapodikSyncAlertState {
  id            String    @id @default("singleton")
  alertOpen     Boolean   @default(false)
  reason        String? // sync-error | stale
  detail        String?
  lastAlertedAt DateTime?
  updatedAt     DateTime  @updatedAt
}
```

Langkah:

1. Edit schema, jalankan `bunx prisma migrate dev --name dapodik_sync_health`
   (butuh DB dev hidup).
2. Verifikasi: `bun run check:schema-migrations` → "✅ Migrasi selaras dengan
   schema.prisma."
3. Commit: `feat(dapodik): tabel DapodikSyncLog + DapodikSyncAlertState`.

## Fase 2 — Kanal email di `notifyAdmin` (TDD)

**File**: [src/lib/notifications.ts](../../../src/lib/notifications.ts) + test.

1. Test dulu di `src/lib/__tests__/notifications.test.ts` (mock `@/lib/email`):
   - `notifyAdmin` memanggil `sendEmail` ke `ADMIN_EMAIL` bila tersedia.
   - Tanpa `ADMIN_EMAIL`/SMTP env → skip tanpa error.
   - `sendEmail` gagal (return false / throw) → hanya log warn, return
     `{ whatsapp, telegram, email: false }`, tidak melempar.
2. Implementasi: tambah bagian email di `notifyAdmin` (paralel dengan kanal
   lain, subject ringkas "CMS MONSA — Alert", body = message). Return type
   bertambah `email: boolean` — pemanggil existing tidak berubah.
3. Verifikasi: `bunx vitest run src/lib/__tests__/notifications.test.ts`.
4. Commit: `feat(notifications): kanal email di notifyAdmin (SMTP/ADMIN_EMAIL)`.

## Fase 3 — Modul inti `dapodik-sync-alert.ts` (TDD)

**File baru**: `src/lib/dapodik-sync-alert.ts` + `src/lib/__tests__/dapodik-sync-alert.test.ts`.

API yang diekspor:

```ts
export type SyncRunMode = "AUTO" | "MANUAL" | "INGEST" | "ARCHIVE";
export interface SyncRunInput {
  mode: SyncRunMode;
  dataType?: string;
  status: "OK" | "ERROR";
  actor?: string;
  counts?: { sekolah?: number; gtk?: number; rombel?: number; siswa?: number };
  durationMs?: number;
  error?: string;
}
export async function recordSyncRun(input: SyncRunInput): Promise<void>;
export async function checkSyncFreshness(): Promise<FreshnessResult>;
export function stalenessThresholdHours(cfg: {
  autoSyncEnabled: boolean;
  autoSyncIntervalHours: number;
}): number;
```

Perilaku (semua dari spec — jangan menyimpang):

- `recordSyncRun`: insert `DapodikSyncLog`; prune `deleteMany` baris di luar
  200 terbaru; sukses → update `DapodikConfig` (`lastSyncAt` = now,
  `lastSyncBy` = actor) + reset state alert bila `alertOpen`; ERROR → upsert
  state (`alertOpen: true`, `reason: "sync-error"`) dan **kirim alert hanya
  bila state belum open atau reason berganti** (dedupe).
- `checkSyncFreshness`: tabel kebenaran spec (config kosong → nonaktif;
  `DAPODIK_SYNC_ALERT_ENABLED=0` → nonaktif; `alertOpen` → dedupe;
  `autoSyncLastStatus=ERROR` tanpa sync sukses setelahnya → `sync-error`
  (backstop); `lastSyncAt` melewati ambang → `stale`; sehat → reset).
- `stalenessThresholdHours`: env `DAPODIK_SYNC_STALE_HOURS` (valid > 0) menang;
  else `autoSyncEnabled` → `max(2 × interval, 48)`; else `168`.
- Sanitasi error: reuse helper dari
  [src/lib/dapodik-ingest-error.ts](../../../src/lib/dapodik-ingest-error.ts)
  (cek nama ekspor saat implementasi); potong 500 char untuk log, 300 untuk
  pesan alert.
- Pesan alert: format spec (mode, waktu WITA, error, hint PC/Dapodik/
  cloudflared, footer CMS MONSA). Kirim via `notifyAdmin` — fire-and-forget,
  try/catch di sekeliling kirim.
- Seluruh `recordSyncRun` dibungkus try/catch — kegagalan pencatatan TIDAK
  boleh menggagalkan sync (log error saja).

Test unit (mock `@/lib/db` seperti pola `storage-alert.test.ts`; mock
`notifyAdmin`): log+prune+update `lastSyncAt`; dedupe tiga kasus (open → diam,
reason ganti → kirim, reset lalu gagal lagi → kirim); reset saat OK; tabel
ambang (env override / auto / manual-only); config kosong nonaktif; sanitasi;
`recordSyncRun` tidak melempar bila insert gagal.

Verifikasi: `bunx vitest run src/lib/__tests__/dapodik-sync-alert.test.ts`.
Commit: `feat(dapodik): modul sync-alert — recordSyncRun + freshness + dedupe`.

## Fase 4 — Hook di jalur sync

**File**: `src/lib/dapodik-sync/plan.ts`, `src/lib/dapodik-scheduler.ts`,
`src/app/api/dapodik/{sync,pull,ingest,archive}/route.ts`.

1. `applyDapodikPayload`: setelah commit sukses (bukan dry-run) →
   `recordSyncRun({ mode: opts.syncMode ?? "MANUAL", status: "OK", actor: opts?.userId, counts: hasilCommit, durationMs })`.
   - Mode asli (`AUTO`/`MANUAL`/`INGEST`) diteruskan lewat `opts` — tambahkan
     field opsional `syncMode?: SyncRunMode` + `dataType?: string` di opts;
     default `"MANUAL"` bila tidak disuplai (back-compat).
2. Pemanggil menyuplai mode:
   - `sync/route.ts` & `pull/route.ts` → `MANUAL`;
   - `auto-sync/route.ts` + `dapodik-scheduler.ts` → `AUTO`, actor
     `"scheduler"`;
   - `ingest/route.ts` → `INGEST`, `dataType` per payload, actor `"bridge"`
     atau `"python"` (dari auth yang dipakai).
   - Dry-run tidak mencatat (validasi test).
3. Jalur gagal: setiap `catch` di route-route di atas + catch scheduler →
   `recordSyncRun({ mode, status: "ERROR", error: sanitized })`.
4. Route `archive` sukses/gagal → `mode: "ARCHIVE"` (counts = jumlah arsip).
5. `durationMs`: ukur `Date.now()` di awal handler/pemanggil commit.
6. Test: perluas `src/lib/__tests__/dapodik-scheduler.test.ts` (catch →
   `recordSyncRun` ERROR) dan test transaksi existing
   (`dapodik-sync-transaction.test.ts`) untuk hook sukses + dry-run tidak
   mencatat.

Verifikasi: `bunx vitest run src/lib/__tests__/dapodik-sync*`. Commit:
`feat(dapodik): catat & alert di semua jalur sync (manual/auto/ingest/archive)`.

## Fase 5 — Cron staleness + registrasi

**File baru**: `src/app/api/cron/dapodik-sync-alert/route.ts` (GET, pola
persis `storage-alert/route.ts`: cek `CRON_SECRET` → 503 bila kosong, 401 bila
Bearer salah, try/catch `checkSyncFreshness()`, `maxDuration = 60`,
`dynamic = "force-dynamic"`).

1. Test dulu `src/lib/__tests__/api/cron-dapodik-sync-alert.test.ts` (pola
   `cron-failure.test.ts`): 401 tanpa/with salah secret; sehat → 200 tanpa
   kirim + state reset; ERROR → kirim; stale → kirim; panggilan kedua → dedupe.
2. Registrasi:
   - [vercel.json](../../../vercel.json) → `{ "path": "/api/cron/dapodik-sync-alert", "schedule": "30 19 * * *" }`
     (03.30 WITA, setelah storage-alert 03.00);
   - [docker-compose.cron.yml](../../../docker-compose.cron.yml) → baris
     crontab: `30 3 * * * /bin/sh /app/scripts/cron-job.sh dapodik-sync-alert /api/cron/dapodik-sync-alert >> /backups/cron.log 2>&1`
     + perbarui echo header;
   - komentar runner di atas file cron diperbarui (sebut 3 job).
3. Commit: `feat(dapodik): cron staleness harian /api/cron/dapodik-sync-alert`.

## Fase 6 — Dashboard: API riwayat + banner + panel

**File baru**: `src/app/api/dapodik/sync-logs/route.ts` — GET, auth session
SUPER_ADMIN/OPERATOR (pola route API dashboard lain; GURU → 403), ambil 20
`DapodikSyncLog` terakhir + `DapodikSyncAlertState` + umur `lastSyncAt`.
Bungkus `withErrorHandling` + logger.error contract.

**UI**:

1. Banner di `Overview` (`overview.tsx`) — komponen kecil
   `dapodik-sync-health-banner.tsx` di modul yang sama: fetch endpoint di atas
   (atau prop dari Overview), tampil hanya untuk SUPER_ADMIN/OPERATOR, dua
   varian pesan (`stale` / `sync-error`), sehat → tidak render apa pun.
2. Panel riwayat di `dapodik-manager/index.tsx` — komponen baru
   `dapodik-sync-history.tsx`: tabel 20 run (waktu WITA, mode+dataType,
   status badge, hitungan, durasi, error ringkas) + tombol refresh.
3. Test komponen (pola test view existing di `src/components/**/__tests__`):
   banner render sesuai state & role; sehat → null; panel menampilkan baris
   dari fixture.

Verifikasi: `bunx vitest run src/components/dashboard` + `bun run typecheck`.
Commit: `feat(dashboard): banner health sync + riwayat 20 run di halaman Dapodik`.

## Fase 7 — E2E

**File**: `prisma/seed-e2e.ts` + `e2e/dapodik-sync-health.spec.ts` baru.

1. `seed-e2e.ts`: upsert singleton `DapodikSyncAlertState` →
   `alertOpen: true, reason: "stale", detail: "Data basi 5 hari"` + 3 baris
   `DapodikSyncLog` (2 OK + 1 ERROR) — idempoten. **Catatan desain**: e2e tidak
   menyentuh Prisma langsung; seed adalah jalur fixture resmi. Banner bersifat
   aditif & inerten untuk spec lain (mereka assert elemen spesifik, bukan
   absensi banner).
2. Spec `dapodik-sync-health.spec.ts`:
   - ADMIN: banner "basi" terlihat di `/dashboard`; panel riwayat menampilkan
     baris seeded; `GET /api/dapodik/sync-logs` 200 berisi rows.
   - GURU: banner tidak tampil; `sync-logs` → 403.
   - `afterEach`: restore kredensial/CSV hanya bila spec menyentuh config —
     spec ini read-only terhadap config, jadi cleanup minimal (protokol CSRF
     tetap diikuti bila ada POST).
   - Pragma warmup: `// warmup: /api/dapodik/sync-logs /dashboard` (verifikasi
     dengan `bun run check:warmup-declarations`).
3. Verifikasi: `bun run test:e2e:local dapodik-sync-health.spec.ts`
   (dev server harus hidup / biarkan wrapper menyalakan).
4. Commit: `test(e2e): spec sync-health — banner, riwayat, RBAC sync-logs`.

## Fase 8 — Dokumentasi & gerbang akhir

1. `.env.example`: dua var baru (`DAPODIK_SYNC_STALE_HOURS`,
   `DAPODIK_SYNC_ALERT_ENABLED`) + komentar.
2. README bagian Deployment/cron + `docs/RUNNING.md`: sebut cron baru
   (Vercel `30 19 * * *`, self-host entri `cron-job.sh`).
3. [docs/CHANGELOG.md](../../CHANGELOG.md): blok baru sesuai format
   Keep-a-Changelog repo (Tanggal, Ditambahkan/Diubah, referensi commit).
4. Gerbang akhir: `bun run check` (penuh) → hijau; `bun run lint:md` → hijau.
5. Commit: `docs: sinkron env/README/CHANGELOG untuk sync health`.

## Strategi commit & risiko

- 8 commit kecil (satu per fase) di `main`, mengikuti gaya konvensional repo
  (`feat(dapodik): …`, `test(e2e): …`, `docs: …`).
- Risiko yang sudah diantisipasi:
  - Migrasi butuh DB dev hidup — jalankan docker compose dev dulu.
  - `opts` `applyDapodikPayload` bertambah field opsional — back-compat
    (pemanggil lama default `MANUAL`), tercakup test transaksi.
  - Singleton alert state di seed e2e — sengaja stale; banner aditif, inerten
    bagi spec lain (dokumen di plan ini, bukan keputusan diam-diam).
  - Nama ekspor sanitizer di `dapodik-ingest-error.ts` diverifikasi saat
    Fase 3; bila tidak cocok, tulis helper redaksi minimal di modul baru
    (tanpa mengubah kontrak ingest).

## Kriteria selesai (dari spec, ulang singkat)

1. Semua jalur sync gagal → satu alert WhatsApp+Telegram+Email, dedupe sampai
   pulih. 2. Data basi → alert cron harian. 3. Banner dashboard sesuai state &
   role. 4. Riwayat 20 run tampil. 5. `bun run check` + E2E hijau. 6. Bridge
   `.exe` tidak berubah.
