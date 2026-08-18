/**
 * Cek log server merged (E2E_SERVER_LOG) untuk sinyal kegagalan server yang
 * TIDAK seharusnya ada di run hijau — "fails on unexpected 5xx / upload
 * failures".
 *
 * Sinyal yang dicari (dua kelas):
 *   1. Response HTTP 5xx — baris request server (` GET /api/x 500 in 123ms`)
 *      dan probe warm-up yang gagal (`[e2e] ✗ /api/x -> 500`). Suite e2e
 *      TIDAK pernah sengaja men-trigger 5xx (semua rejection path memakai
 *      400), jadi 5xx mana pun = regresi nyata.
 *   2. `[bos-documents] upload failed` — catch-block rute upload
 *      (console.error → stderr; mengembalikan 500). INI BEDA dari
 *      "unggahan ditolak" yang merupakan rejections 400 dan memang dites
 *      spec (file-tidak-ada / terlalu-besar / bukan-pdf / validasi-gagal).
 *
 * Sumber: E2E_SERVER_LOG (artifact merged: section wrapper + output server)
 * + sibling `.err` (stderr server — tempat console.error mengalir). Keduanya
 * dipindai; temuan digabung dan dilaporkan per file.
 *
 * Exit 0 bila bersih; exit 1 bila ada temuan (fails the run). Temuan ditulis
 * ke konsol + $GITHUB_STEP_SUMMARY (section ❌) agar terlihat di UI workflow
 * tanpa mengunduh artifact.
 *
 * Allowlist opsional: E2E_LOG_ALLOW — regex (baris per baris) yang dianggap
 * normal, mis. 5xx dari endpoint yang sengaja diuji di masa depan.
 */
import { appendFileSync, readFileSync } from "node:fs";

const SERVER_LOG = process.env.E2E_SERVER_LOG ?? "server-e2e.log";
const ALLOW = (process.env.E2E_LOG_ALLOW ?? "")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((p) => new RegExp(p));

// Response 5xx di baris request server: ` GET /api/x 500 in 123ms`.
const HTTP_5XX = /\b(5\d\d) in \d+ms\b/;
// Probe warm-up gagal: `[e2e] ✗ /api/x -> 500`.
const WARMUP_5XX = /-> (5\d\d)\b/;
// Catch-block rute upload BOS (console.error → stderr).
const UPLOAD_FAILED = /\[bos-documents\] upload failed/;

const emit = (m: string) => console.log(m);

const SIGNALS: { name: string; re: RegExp }[] = [
  { name: "5xx (request server)", re: HTTP_5XX },
  { name: "5xx (probe warm-up)", re: WARMUP_5XX },
  { name: "upload BOS gagal", re: UPLOAD_FAILED },
];

function scanFile(path: string): string[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const found: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sig of SIGNALS) {
      if (!sig.re.test(line)) continue;
      // Allowlist — baris yang dianggap normal dilewati.
      if (ALLOW.some((re) => re.test(line))) continue;
      // Konteks: baris sebelum/berikutnya untuk melihat detail (mis. reason
      // pada blok `upload failed { ... }`).
      const prev = lines[i - 1]?.trim() ?? "";
      const next = lines[i + 1]?.trim() ?? "";
      const ctx = [prev, line.trim(), next].filter(Boolean).join(" | ");
      found.push(`L${i + 1} [${sig.name}] ${ctx}`);
      // Satu baris bisa cocok dengan beberapa sinyal — cukup satu kali.
      break;
    }
  }
  return found;
}

function main(): number {
  const files = [SERVER_LOG, `${SERVER_LOG}.err`];
  const findings: { file: string; lines: string[] }[] = [];

  for (const f of files) {
    const hits = scanFile(f);
    if (hits.length > 0) findings.push({ file: f, lines: hits });
  }

  if (findings.length === 0) {
    emit(`[e2e:logcheck] bersih — tidak ada 5xx / upload gagal di ${SERVER_LOG}.`);
    return 0;
  }

  const total = findings.reduce((n, f) => n + f.lines.length, 0);
  const body: string[] = [];
  body.push("## ❌ Sinyal kegagalan server di log e2e");
  body.push("");
  body.push(
    `Ditemukan **${total} baris** 5xx / upload-failed — suite hijau seharusnya ` +
      `nol. Periksa penyebab (regresi handler / cold-compile 500).`
  );
  body.push("");
  for (const f of findings) {
    body.push(`**${f.file}** — ${f.lines.length} temuan:`);
    body.push("");
    for (const l of f.lines.slice(0, 10)) body.push(`- \`${l}\``);
    if (f.lines.length > 10) body.push(`- … +${f.lines.length - 10} lainnya`);
    body.push("");
  }
  const text = body.join("\n");
  emit(`[e2e:logcheck] ${total} temuan di ${findings.map((f) => f.file).join(", ")}`);
  emit(`\n${text}`);

  const sp = process.env.GITHUB_STEP_SUMMARY;
  if (sp) {
    try {
      appendFileSync(sp, `${text}\n\n`);
      emit("[e2e:logcheck] temuan ditambahkan ke step summary.");
    } catch (e) {
      emit(`[e2e:logcheck] gagal menulis step summary: ${String(e)}`);
    }
  }

  emit("::error::Sinyal 5xx / upload-failed di log server e2e — cek baris di atas.");
  return 1;
}

process.exit(main());
