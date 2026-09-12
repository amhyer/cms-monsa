/**
 * Seed + assert untuk E2E self-host stack (docker-compose.e2e.yml).
 * Jalankan setelah stack up dan app healthy. Seed via psql di container
 * (deterministik, tanpa kredensial admin):
 *
 *   bun scripts/e2e-selfhost-assert.ts
 *
 * Seksi I juga login sebagai SUPER_ADMIN yang di-seed (password di-hash
 * scrypt dengan parameter yang sama dengan src/lib/password.ts) dan
 * memverifikasi /api/storage-usage: fileCount/totalBytes, persen kuota
 * (1 desimal), dan kandidat cleanup — akurat terhadap seed yang diketahui.
 */
import { execSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";

const APP = "http://127.0.0.1:3100";
const CRON_SECRET = "e2e-cron-secret";
/** Nama container stack E2E (sengaja beda dari stack produksi — lihat
 * docker-compose.e2e.yml). Env override untuk pengetesan lokal. */
const PSQL_CONTAINER = process.env.E2E_PG_CONTAINER ?? "monsa-postgres-e2e";
const CRON_CONTAINER = process.env.E2E_CRON_CONTAINER ?? "monsa-cron-e2e";

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
  channels?: { whatsapp: boolean; telegram: boolean };
  fileCount?: number;
  totalBytes?: number;
  impact?: {
    referencedCandidates: number;
    safeCandidates: number;
    byEntity: Record<string, number>;
  } | null;
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
    `docker exec ${PSQL_CONTAINER} psql -U postgres -d cms_mongisidi -At -c ${JSON.stringify(sql)}`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();
}

async function cronGet(path: string) {
  const res = await fetch(`${APP}${path}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  return { status: res.status, body: await jq(res) };
}

async function cronPost(path: string, body: unknown, auth = true) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST",
    headers: {
      ...(auth ? { authorization: `Bearer ${CRON_SECRET}` } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
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

  // A2. endpoint laporan kegagalan cron (runner → notifyAdmin → admin)
  const cfAnon = await cronPost("/api/cron/cron-failure", { job: "x", attempts: 1 }, false);
  ok(cfAnon.status === 401, "cron-failure tanpa token → 401", `HTTP ${cfAnon.status}`);
  const cfBad = await cronPost("/api/cron/cron-failure", { job: "", attempts: 99 });
  ok(cfBad.status === 400, "cron-failure body tidak valid → 400", `HTTP ${cfBad.status}`);
  const cfOk = await cronPost("/api/cron/cron-failure", {
    job: "cleanup-uploads",
    attempts: 2,
    lastError: "e2e: simulated failure",
    lastBody: "(body kosong)",
  });
  ok(
    cfOk.status === 200 && cfOk.body?.ok === true,
    "cron-failure laporan valid → 200 (notifyAdmin dijalankan)",
    JSON.stringify(cfOk.body).slice(0, 140)
  );
  ok(
    typeof cfOk.body?.channels?.whatsapp === "boolean" &&
      typeof cfOk.body?.channels?.telegram === "boolean",
    "cron-failure: channels dilaporkan (E2E tanpa kanal → false/false)",
    JSON.stringify(cfOk.body?.channels)
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
  ok(sa2.body?.notified === true, "62.9% ≥ 50% → notified=true", JSON.stringify(sa2.body).slice(0, 160));
  const stateRow = psql(
    `SELECT "aboveThreshold","lastChannelsWhatsapp","lastChannelsTelegram" FROM "StorageAlertState" WHERE id='singleton';`
  );
  // aboveThreshold wajib tercatat; kanal bisa false bila tidak ada kanal
  // notifikasi terkonfigurasi (alert tetap "terkirim" secara logika cron).
  ok(stateRow.startsWith("t|"), "StorageAlertState: aboveThreshold tercatat", stateRow);

  // G. dedup — panggilan kedua tidak mengirim ulang
  const sa3 = await cronGet("/api/cron/storage-alert");
  ok(sa3.body?.notified === false, "dedup: panggilan kedua notified=false", `notified=${sa3.body?.notified}`);

  // Pulihkan keadaan seed kanonik: file trigger 600 KB dihapus, sehingga
  // seksi H/I bekerja pada keadaan pasca-cleanup yang deterministik
  // (2 file × 30.000 B — tanpa pengaruh trigger seksi F).
  psql(`DELETE FROM "UploadedFile" WHERE id='big1';`);
  const restoreCount = psql(`SELECT count(*) FROM "UploadedFile";`);
  ok(
    restoreCount.trim() === "2",
    "state dipulihkan: 2 file tersisa setelah trigger F dihapus",
    restoreCount.trim()
  );

  // Marker waktu: tulis ke /backups/cron.log SEKARANG, sebelum jendela
  // tunggu H. Siklus retry yang terlihat SETELAH baris ini terbukti
  // dijalankan selama jendela — bukan sisa log dari siklus sebelum marker.
  const marker = `e2e-marker ${new Date().toISOString()}`;
  // Kutip ganda di luar: execSync Windows (cmd.exe) memperlakukan kutip
  // tunggal sebagai karakter biasa — pola yang sama dengan execSync lain
  // di file ini.
  execSync(
    `docker exec ${CRON_CONTAINER} sh -c "echo '${marker}' >> /backups/cron.log"`,
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  // H. cron container per-menit: tunggu ≥2 siklus, lalu cek log backup
  console.log("menunggu 130 detik untuk cron container (jadwal per-menit)…");
  await new Promise((r) => setTimeout(r, 130_000));
  const cronLog = execSync(
    `docker exec ${CRON_CONTAINER} sh -c "cat /backups/cron.log; echo ---; cat /backups/backup.log"`,
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
  const backupsListed = execSync(`docker exec ${CRON_CONTAINER} ls /backups`, {
    encoding: "utf8",
  }).trim();
  ok(
    /db-\d{8}-\d{6}\.sql/.test(backupsListed),
    "backup .sql ada di /backups",
    backupsListed.replace(/\n/g, ", ")
  );
  // Job selalu-gagal (menyasar endpoint yang tidak ada): runner harus
  // menghabiskan 2 percobaan lalu melaporkan kegagalan ke app — baris log
  // "laporan kegagalan terkirim" membuktikan POST cron-failure sukses
  // (guard Bearer diterima app), artinya admin dinotifikasi end-to-end.
  ok(
    /\[always-fails\] percobaan-2 gagal/.test(cronLog),
    "cron container: job selalu-gagal menghabiskan retry (2 percobaan)",
    (cronLog.match(/\[always-fails\] percobaan-2 gagal.*$/) ?? [""])[0].slice(0, 160)
  );
  ok(
    /\[always-fails\] laporan kegagalan terkirim ke app/.test(cronLog),
    "cron container: kegagalan dilaporkan ke /api/cron/cron-failure",
    (cronLog.match(/\[always-fails\] laporan kegagalan.*$/) ?? [""])[0].slice(0, 160)
  );

  // Uji timing retry: dua baris "percobaan gagal" saja tidak membuktikan
  // retry — bisa jadi dua fire cron yang berbeda. Bukti sesungguhnya:
  // (1) pasangan percobaan-1 → percobaan-2 ada SETELAH marker (dijalankan
  // dalam jendela ini), dan (2) jeda terukur antara keduanya ≥ yang
  // di-claim runner sendiri di baris "mengulang dalam N detik" — membuktikan
  // proses benar-benar menunggu RETRY_DELAY_SEC, bukan langsung mencoba ulang.
  // (Job lain bisa menyisipkan baris di antara; cari maju, jangan asumsikan
  // baris tetangga.)
  const lines = cronLog.split("\n");
  const markerIdx = lines.findIndex((l) => l.includes("e2e-marker"));
  ok(markerIdx >= 0, "marker waktu tertulis di cron.log", lines[markerIdx]?.slice(0, 80) ?? "");
  const postMarker = markerIdx >= 0 ? lines.slice(markerIdx + 1) : [];
  const idx1 = postMarker.findIndex((l) => /\[always-fails\] percobaan-1 gagal/.test(l));
  const idx2 = postMarker.findIndex((l) => /\[always-fails\] percobaan-2 gagal/.test(l));
  ok(
    idx1 >= 0 && idx2 > idx1,
    "siklus retry utuh setelah marker (percobaan-1 lalu percobaan-2)",
    idx1 >= 0 && idx2 > idx1
      ? `${postMarker[idx1].slice(0, 90)} → ${postMarker[idx2].slice(0, 90)}`
      : `idx1=${idx1} idx2=${idx2}`
  );
  const logTs = (l: string) => {
    const m = l.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
    // Keduanya diparse lokal — selisih tetap benar di zona waktu apa pun.
    return m ? Date.parse(m[1].replace(" ", "T")) : NaN;
  };
  const claimed = Number(
    postMarker
      .slice(idx1 + 1)
      .find((l) => /mengulang dalam (\d+) detik/.test(l))
      ?.match(/mengulang dalam (\d+) detik/)?.[1] ?? NaN
  );
  const gapSec = Math.round((logTs(postMarker[idx2]) - logTs(postMarker[idx1])) / 1000);
  // Batas atas claimed+65 detik: bila proses ulangan mati sebelum
  // percobaan-2, crond menyalakan siklus MENIT berikutnya — gap maksimum
  // legal ≈ 60−RETRY_DELAY+60k. Gap ≥ 5 menit berarti baris percobaan-2
  // diambil dari fire yang salah (bentuk bug yang dulu pernah terjadi).
  ok(
    Number.isFinite(claimed) && gapSec >= claimed && gapSec < claimed + 65,
    `retry benar-benar menunggu (jeda terukur ${gapSec}s ≥ ${claimed}s yang di-claim runner)`,
    `gap=${gapSec}s, claimed=${claimed}s`
  );

  // I. login SUPER_ADMIN (seeded) → /api/storage-usage akurat
  // Seed state dikenal pasca-cleanup: 2 file × 30.000 B (new1, new2).
  // Kuota E2E = 1 MB; usagePercent = round(total/quota*1000)/10 = 5.7.
  console.log("login SUPER_ADMIN + verifikasi /api/storage-usage…");
  const ADMIN_EMAIL = "e2e-admin@selfhost.test";
  const ADMIN_PASSWORD = "e2e-admin-pass-1234";
  // Hash scrypt “salt:hash” — parameter identik dengan src/lib/password.ts
  // (N=131072, r=8, p=1, keylen 64, maxmem 256 MB) agar verifyPassword
  // menerima seed ini.
  const { salt, hash } = (() => {
    const s = randomBytes(16).toString("hex");
    const h = scryptSync(ADMIN_PASSWORD, s, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    }).toString("hex");
    return { salt: s, hash: h };
  })();
  psql(
    `INSERT INTO "User" ("id","name","email","password","role","isActive","mustChangePassword","twoFactorEnabled","createdAt","updatedAt")
     VALUES ('e2e-admin','E2E Admin','${ADMIN_EMAIL}','${salt}:${hash}','SUPER_ADMIN',true,false,false,now(),now())
     ON CONFLICT ("email") DO UPDATE SET "password"=EXCLUDED."password", "role"='SUPER_ADMIN', "isActive"=true, "updatedAt"=now();`
  );
  const loginRes = await fetch(`${APP}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  ok(loginRes.status === 200, "login SUPER_ADMIN seeded → 200", `HTTP ${loginRes.status}`);
  const setCookies = loginRes.headers.getSetCookie();
  const sessionCookie = setCookies.find((c) => c.startsWith("__Host-monsa_session="));
  ok(
    sessionCookie !== undefined,
    "Set-Cookie sesi (__Host-monsa_session) diterbitkan",
    `${setCookies.length} cookie`
  );

  if (sessionCookie) {
    const cookiePair = sessionCookie.split(";")[0];
    const su = await fetch(`${APP}/api/storage-usage`, {
      headers: { cookie: cookiePair },
    });
    const suBody = await jq(su);
    ok(su.status === 200, "storage-usage dengan sesi admin → 200", `HTTP ${su.status}`);

    // Angka akurat terhadap seed: 2 file × 30.000 B = 60.000 B dari 1 MB
    // → 60000/1048576*100 = 5.722… → 1 desimal = 5.7. Kandidat cleanup = 0
    // (keduanya baru; retensi E2E 30 hari).
    const expectedTotal = 60_000;
    const expectedPct = Math.round((expectedTotal / (1024 * 1024)) * 1000) / 10; // 5.7
    ok(
      suBody?.fileCount === 2,
      "fileCount akurat (2 setelah cleanup)",
      `fileCount=${suBody?.fileCount}`
    );
    ok(
      suBody?.totalBytes === expectedTotal,
      "totalBytes akurat (60000)",
      `totalBytes=${suBody?.totalBytes}`
    );
    ok(
      suBody?.usagePercent === expectedPct,
      `usagePercent akurat (${expectedPct}% dari kuota 1 MB)`,
      `usagePercent=${suBody?.usagePercent}`
    );
    ok(
      suBody?.cleanupCandidates === 0,
      "cleanupCandidates akurat (0 — semua file baru)",
      `cleanupCandidates=${suBody?.cleanupCandidates}`
    );

    // Impact lapangan diperiksa juga — object harus ada (route menghitung
    // referensi konten; tanpa konten perujuk → 0/0/{}).
    ok(
      suBody?.impact !== null && suBody?.impact !== undefined,
      "impact terisi (route menghitung referensi konten)",
      JSON.stringify(suBody?.impact)
    );
  }

  console.log(failures === 0 ? "\nSEMUA PASS" : `\n${failures} ASSERT GAGAL`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E error:", e);
  process.exit(1);
});
