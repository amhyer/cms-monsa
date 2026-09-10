/**
 * Seed + assert untuk E2E self-host stack (docker-compose.e2e.yml).
 * Jalankan setelah stack up dan app healthy. Seed via psql di container
 * (deterministik, tanpa kredensial admin):
 *
 *   bun scripts/e2e-selfhost-assert.ts
 */
import { execSync } from "node:child_process";

const APP = "http://127.0.0.1:3100";
const CRON_SECRET = "e2e-cron-secret";

let failures = 0;
function ok(cond: boolean, label: string, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

/** Shape JSON yang relevan dari endpoint cron/alert (subset yang di-assert). */
type ApiBody = {
  ok?: boolean;
  error?: string;
  disabled?: boolean;
  retentionDays?: number;
  deleted?: number;
  freedBytes?: number;
  cutoffAt?: string | null;
  skipped?: string | null;
  thresholdPct?: number;
  usagePercent?: number | null;
  aboveThreshold?: boolean;
  notified?: boolean;
  notifiedChannels?: { whatsapp: boolean; telegram: boolean };
  timestamp?: string;
};

async function jq(res: Response): Promise<ApiBody | null> {
  try {
    return (await res.json()) as ApiBody;
  } catch {
    return null;
  }
}

function psql(rawSql: string): string {
  // Satu baris — shell quoting lintas-platform (Windows cmd) merusak newline.
  const sql = rawSql.replace(/\s*\n\s*/g, " ").trim();
  return execSync(
    `docker exec monsa-postgres psql -U postgres -d cms_mongisidi -At -c ${JSON.stringify(sql)}`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
}

async function cronGet(path: string) {
  const res = await fetch(`${APP}${path}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  return { status: res.status, body: await jq(res) };
}

async function main() {
  console.log("== E2E self-host assert ==", new Date().toISOString());

  // A. health app
  const health = await fetch(`${APP}/api/health`);
  const healthBody = await jq(health);
  ok(
    health.ok && healthBody?.status === "healthy",
    "app /api/health healthy",
    `HTTP ${health.status}`
  );

  // B. seed deterministik via psql — 5 lama (retensi e2e = 30 hari) + 2 baru
  psql(`DELETE FROM "UploadedFile"; DELETE FROM "StorageAlertState";`);
  psql(
    `INSERT INTO "UploadedFile" ("id","filename","mimeType","size","data","createdAt") VALUES
      ('old1','old1.jpg','image/jpeg',40000,'\\x41', now() - interval '60 days'),
      ('old2','old2.jpg','image/jpeg',40000,'\\x41', now() - interval '60 days'),
      ('old3','old3.pdf','application/pdf',40000,'\\x41', now() - interval '60 days'),
      ('old4','old4.jpg','image/jpeg',40000,'\\x41', now() - interval '60 days'),
      ('old5','old5.jpg','image/jpeg',40000,'\\x41', now() - interval '60 days'),
      ('new1','new1.jpg','image/jpeg',30000,'\\x42', now()),
      ('new2','new2.png','image/png',30000,'\\x42', now());`
  );
  const seeded = Number(psql(`SELECT count(*) FROM "UploadedFile";`));
  ok(seeded === 7, "seed: 7 file di DB (5 lama + 2 baru)", `count=${seeded}`);

  // C. guard: storage-usage & cron tanpa sesi/token harus ditolak
  const suAnon = await fetch(`${APP}/api/storage-usage`);
  ok(suAnon.status === 401 || suAnon.status === 403, "storage-usage tanpa sesi → ditolak", `HTTP ${suAnon.status}`);
  const noauth = await fetch(`${APP}/api/cron/cleanup-uploads`);
  ok(noauth.status === 401, "cleanup tanpa token → 401", `HTTP ${noauth.status}`);

  // D. cleanup-uploads: 200 ok, hanya file lama yang dihapus
  const cl = await cronGet("/api/cron/cleanup-uploads");
  ok(cl.status === 200 && cl.body?.ok === true, "cleanup-uploads: 200 ok", JSON.stringify(cl.body).slice(0, 140));
  ok(cl.body?.deleted === 5, "cleanup: 5 file lama dihapus", `deleted=${cl.body?.deleted}`);
  ok(cl.body?.freedBytes === 200_000, "cleanup: freedBytes=200000", `freed=${cl.body?.freedBytes}`);
  const remaining = Number(psql(`SELECT count(*) FROM "UploadedFile";`));
  ok(remaining === 2, "pasca-cleanup: 2 file tersisa di DB", `count=${remaining}`);

  // E. storage-alert di bawah ambang (usage 60 KB / 1 MB = 6% < 50%)
  const sa = await cronGet("/api/cron/storage-alert");
  ok(sa.status === 200 && sa.body?.ok === true, "storage-alert: 200 ok", JSON.stringify(sa.body).slice(0, 140));
  ok(sa.body?.notified === false, "di bawah ambang → notified=false", `notified=${sa.body?.notified}`);

  // F. lewati ambang → notified=true + state tercatat
  psql(
    `INSERT INTO "UploadedFile" ("id","filename","mimeType","size","data","createdAt")
     VALUES ('big1','big1.jpg','image/jpeg',600000,'\\x41', now());`
  );
  const sa2 = await cronGet("/api/cron/storage-alert");
  ok(sa2.body?.notified === true, "58% ≥ 50% → notified=true", JSON.stringify(sa2.body).slice(0, 160));
  const stateRow = psql(
    `SELECT "aboveThreshold","lastChannelsWhatsapp","lastChannelsTelegram" FROM "StorageAlertState" WHERE id='singleton';`
  );
  // aboveThreshold wajib tercatat; kanal bisa false bila tidak ada kanal
  // notifikasi terkonfigurasi (alert tetap "terkirim" secara logika cron).
  ok(stateRow.startsWith("t|"), "StorageAlertState: aboveThreshold tercatat", stateRow);

  // G. dedup — panggilan kedua tidak mengirim ulang
  const sa3 = await cronGet("/api/cron/storage-alert");
  ok(sa3.body?.notified === false, "dedup: panggilan kedua notified=false", `notified=${sa3.body?.notified}`);

  // H. cron container per-menit: tunggu ≥2 siklus, lalu cek log backup
  console.log("menunggu 130 detik untuk cron container (jadwal per-menit)…");
  await new Promise((r) => setTimeout(r, 130_000));
  const cronLog = execSync(
    `docker exec cms-monsa-cron sh -c "cat /backups/cron.log; echo ---; cat /backups/backup.log"`,
    { encoding: "utf8" }
  );
  ok(
    /"ok":true/.test(cronLog),
    "cron container: cron.log mencatat cleanup/alert ok=true",
    cronLog.split("---")[0].slice(0, 200)
  );
  // Runner cron-job.sh: label + percobaan + body pada satu baris log.
  ok(
    /\[cleanup-uploads\] percobaan-1 ok body=/.test(cronLog),
    "cron container: job lewat runner (label + percobaan + body)",
    (cronLog.match(/\[cleanup-uploads\].*$/) ?? [""])[0].slice(0, 160)
  );
  ok(
    /Backup PostgreSQL ->/.test(cronLog),
    "cron container: backup.log mencatat pg_dump sukses",
    (cronLog.split("---")[1] ?? "").slice(0, 200)
  );
  const backupsListed = execSync(`docker exec cms-monsa-cron ls /backups`, {
    encoding: "utf8",
  }).trim();
  ok(
    /db-\d{8}-\d{6}\.sql/.test(backupsListed),
    "backup .sql ada di /backups",
    backupsListed.replace(/\n/g, ", ")
  );

  console.log(failures === 0 ? "\nSEMUA PASS" : `\n${failures} ASSERT GAGAL`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E error:", e);
  process.exit(1);
});
