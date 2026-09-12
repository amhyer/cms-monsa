# PR: Storage management, schema drift gate, and self-host hardening

> **Suggested title:**
> `feat: upload storage management, schema drift gate in CI, and self-host deployment hardening`

---

## Summary

This PR closes three operational gaps that surfaced while running the CMS on Vercel + Neon free tier, and completes the self-host (Docker) escape path. Everything here was validated against real infrastructure — real Postgres containers, real cron scheduling, real HTTP calls — not mocks.

### 1. Upload storage management (`UploadedFile` + quota)

Uploads on Vercel live as `bytea` rows in Neon, where the free tier's storage quota is the hard ceiling. This PR adds the full lifecycle:

- **`/api/storage-usage`** (SUPER_ADMIN) — file count, total bytes, per-MIME breakdown, quota percent (from `NEON_STORAGE_QUOTA_MB`), cleanup candidates, reference impact, and alert state in one report. `scripts/upload-storage-stats.ts` exposes the same report from the CLI.
- **Automatic cleanup** — `/api/cron/cleanup-uploads` (Vercel Cron daily, WITA) deletes uploads older than `UPLOAD_RETENTION_DAYS` (default 90). One owner for retention semantics: `retentionCutoff()`/`uploadRetentionDays()` in `upload-cleanup.ts`, shared by cleanup and stats. An empty env value no longer silently disables cleanup.
- **Reference impact reporting** — before relying on age-based deletion, `/api/storage-usage` counts how many news/gallery/BOS-document items still reference deletion candidates (the 404 risk) and names the referring entities.
- **Quota alerts** — `/api/cron/storage-alert` notifies the admin via the existing WhatsApp/Telegram pipeline when usage crosses `STORAGE_ALERT_THRESHOLD_PCT` (default 80%), with hysteresis and dedup state in `StorageAlertState`. Every send attempt is recorded (`lastSendAt` + per-channel result, migration `20260910000000`), including all-channels-failed, so a silently broken notifier is visible.

### 2. Schema drift gate in CI

Production had drifted from the migration history (the `mustChangePassword` incident). To make that class of failure impossible to reintroduce:

- **`scripts/check-schema-migrations.ts`** — replays all migrations in a throwaway Postgres and diffs the result against `prisma/schema.prisma`; fails the build on any drift.
- Wired into both pipelines: the `validate` job in `ci.yml` (two Postgres service containers) and `deploy-vercel.yml` (before `migrate deploy` touches Neon).
- **Idempotent reconciliation migration** (`20260908000001_reconcile_schema_drift`, 519 lines) realigns the DB with the schema without touching data — built from pristine `drift` SQL, `CREATE … IF NOT EXISTS` throughout, verified to replay cleanly on both a drifted and a fresh database.
- **Pre-deploy P3005 guard** — `deploy-vercel.yml` now runs `check:predeploy-db` before `migrate deploy`: a production DB with tables but no `_prisma_migrations` ledger (pure `db push` state) fails the job at the guard with a pointer to the baseline runbook instead of Prisma's cryptic P3005 error mid-deploy. Partially/fully baselined DBs pass through; unreachable DBs fail early with a clear message. Validated live against five real Postgres states, including a mirror of the partially-baselined production DB found in a read-only dry run (12/16 applied, `migrate deploy` closes the gap — no `resolve` needed).

### 3. Self-host hardening (Docker)

The documented escape path from Vercel now actually works end-to-end:

- **Production image builds again** — the first run of the new CI image gate caught three real bugs: `corepack prepare bun@latest` broke on current `node:20-alpine` (bun now copied from `oven/bun:1-alpine`), the deps stage was missing `prisma/schema.prisma` for the postinstall, and the runner's piecemeal Prisma CLI tree crashed with `Cannot find module 'effect'` (now a version-pinned `prisma-cli` stage).
- **CI boots the image for real** — the `docker-build` job runs the container against a fresh Postgres, waits for `/api/health` to report healthy with a DB check, and asserts via psql that the ledger is filled, nothing rolled back, and `User.mustChangePassword` exists. On pushes to `main`, the **exact image that passed the boot smoke** is retagged and pushed to GHCR as `sha-<full-sha>` + `latest` (no rebuild — the registry always holds the smoke-tested artifact; PRs and branch pushes never touch the registry).
- **Cron container with retry** — `docker-compose.cron.yml` schedules backup (02.00), cleanup (02.30), and storage-alert (03.00) via `scripts/cron-job.sh`: one retry 5 minutes after a failure, with every attempt logged (response body on success, wget's error line — e.g. `HTTP/1.1 401 Unauthorized` — on failure), so failed cron runs are diagnosable from `/backups/cron.log` alone. `CRON_SECRET` is hard-required so a forgotten token fails at compose time instead of producing silent 401s daily.
- **E2E harness, one command** — `npm run e2e:selfhost` (`scripts/run-e2e-selfhost.ts`) owns the full lifecycle: preflight (engine up, ports free, clash-guard against a running prod stack), compose up, health wait, assertions, and always-run teardown (container logs preserved on failure). A CI job (`selfhost-e2e`) runs the same harness on every PR with a GHA-cached image build; E2E containers are named `*-e2e` so a test stack can never clobber a running production stack. `docker-compose.e2e.yml` (local-only) + `scripts/e2e-selfhost-assert.ts` boot the full stack on separate ports with per-minute cron schedules and assert, against the real stack: auth guards, cleanup deleting exactly the past-retention rows (count + freed bytes), admin login + exact `/api/storage-usage` numbers (fileCount/totalBytes/quota %/candidates/impact), alert threshold/dedup/state recording, all three cron jobs actually firing from the container with `pg_dump` artifacts, a permanent `always-fails` job proving total-failure reports reach `/api/cron/cron-failure`, and a marker-then-verify timing test proving retries genuinely wait `RETRY_DELAY_SEC` (cycle after a pre-wait log marker + measured inter-attempt gap ≥ the runner's own claimed delay). 36/36 assertions pass.
- **Cron-failure alerts** — when the runner exhausts its retry, it reports to `POST /api/cron/cron-failure` (same Bearer `CRON_SECRET` guard) and the app notifies admins via the existing `notifyAdmin` pipeline (17 contracted unit tests; strict validation, truncated details, per-channel results returned). Best-effort by design: it never changes the job's exit code, and if the app itself is down the report fails into `cron.log` — the documented fallback.
- **Baseline runbook** — `docs/RUNBOOK-BASELINE-NEON.md` is the validated procedure for baselining the existing db-pushed Neon DB with `migrate resolve` (parity diff as a mandatory gate, because `migrate resolve` validates nothing — proven live). Cross-linked from all deployment docs at the `P3005` failure point.

### 4. Admin UX for all of the above

- **Storage Upload panel** on the dashboard home: quota bar, cleanup candidates, reference impact, last alert status, **Test Alert** button (real `notifyAdmin` pipeline), and manual reload. A successful test send records `StorageAlertState.lastTestedAt` (migration `20260911000000`), so the panel can show **"Diuji: <time>"** — when the alert path was last verified by a human — alongside the cron's own last-send record.
- **Storage quota widget** in the sidebar (SUPER_ADMIN, every admin page): colored bar (red ≥ 80%), totals, cleanup candidates, links to the home panel. Panel and widget share one `useStorageUsage` hook.
- **Settings → Alert Admin health card**: two distinct chips — **"Kirim cron terakhir"** (amber = never ran, green = ≥ 1 channel delivered, red = all failed) and **"Uji manual terakhir"** (from the test-alert route, recorded per attempt into separate `lastTestSendAt`/`lastTestChannels*` columns) — refreshed after a test send.
- **Send-health row in the Storage Upload panel**: "Kirim cron: …" and "Uji manual: …" with per-channel results, reusing the same `alertState` data already in `/api/storage-usage` (no extra fetch, one data owner).

Also includes the Jembatan Dapodik bridge overhaul and download-section fixes that were part of this branch's history.

---

## Test plan

- **Unit/component:** 808/808 tests across 67 files (`bun run check` = typecheck + eslint + markdownlint + vitest; repo pre-commit and pre-push gates re-run the same suite).
- **Self-host E2E locally, final state:** 36/36 assertions against real containers, including the admin-login/storage-usage section and the retry-timing proof (measured gap 2s == claimed 2s, cycle strictly after the marker).
- **Schema drift gate:** `check:schema-migrations` passes on the reconciled history (17 migrations) and correctly fails on injected drift; verified live against a real shadow Postgres.
- **Pre-deploy P3005 guard:** validated against five real Postgres states (P3005, partial-baseline 12/16 mirroring production, fresh, unreachable, no-env) plus a negative control proving `migrate deploy` genuinely fails P3005 on the guarded state.
- **Self-host E2E (real Docker stack):** compose up → 16/16 migrations applied → app healthy → cleanup deleted exactly 5 of 7 seeded uploads (`freedBytes=200000`, 2 rows left) → storage-alert fired at 62.9% ≥ 50% with state recorded and deduped on the second call → the cron container's own crontab fired all three jobs (`cron.log` + `backup.log` + `db-*.sql` / `uploads-*.tar.gz` artifacts) → runner retry paths proven live (401, connection refused, success).
- **Baseline runbook:** every command executed against a simulated db-pushed Postgres before being documented — including the recovery path (`--rolled-back` cannot undo a baseline; the working recovery is deleting the `_prisma_migrations` rows).

---

## Tradeoffs & notes for reviewers

- **The cron-failure endpoint has no dedup, deliberately.** Jobs run daily with max 2 attempts, so a persistently broken job means ≤ 1 report per job per day — that cadence is the feature, not spam.
- **Backup failures don't reach the cron-failure path yet.** `backup-db.sh` doesn't go through the runner, so a failed `pg_dump` stays silent — the one known coverage gap in failure alerting.

- **Uploads stay DB-backed on Vercel.** Serverless filesystems are ephemeral, so `bytea` remains the correct backend there; self-host defaults to disk. The `NEON_*` env names are kept on self-host as a "reference quota" for dashboard/alert consistency (noted in compose comments).
- **Age-based deletion can 404 still-referenced files.** That's why the impact report exists; the migration guide (§5.2) tells self-host operators to keep the DB fallback or export old files before enabling retention.
- **The E2E compose override is local-only by design** (separate ports, per-minute cron, weak secrets) — it is documented as never-for-production.
- **CI runs the drift check twice** (CI validate + pre-deploy). Deliberate: the deploy-time run protects against drift introduced between CI and deploy.
- **Two alert schedulers can coexist during rollback windows.** The migration guide says explicitly to keep only one enabled to avoid duplicate notifications (dedup state is shared via the DB, but timing differs).
