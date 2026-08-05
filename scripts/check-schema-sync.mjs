#!/usr/bin/env node
/**
 * Guard sinkronisasi skema Prisma (REFACTOR_PLAN #8):
 * memastikan model-model di prisma/schema.prisma (SQLite dev) tercermin
 * identik di prisma/schema.postgres.prisma (varian produksi).
 *
 * Hanya bagian model (mulai penanda "---------- RBAC ----------") yang
 * dibandingkan — header komentar dan `provider` datasource (sqlite vs
 * postgresql) memang sengaja berbeda dan diabaikan.
 *
 * Dipakai oleh `npm run check` (pre-commit hook + CI) agar fitur baru
 * (model/field/index baru) tidak pernah tertinggal di varian Postgres.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV = path.join(ROOT, "prisma", "schema.prisma");
const PG = path.join(ROOT, "prisma", "schema.postgres.prisma");
const MARKER = "---------- RBAC ----------";

function modelSection(file) {
  let text = readFileSync(file, "utf8");
  // Normalisasi line ending agar guard kebal terhadap CRLF/LF drift
  // (mis. checkout Windows dengan autocrlf yang berbeda per file).
  text = text.replace(/\r\n/g, "\n");
  const idx = text.indexOf(MARKER);
  if (idx === -1) {
    throw new Error(`Penanda "${MARKER}" tidak ditemukan di ${file}`);
  }
  return text.slice(idx).replace(/\s+$/, "");
}

const dev = modelSection(DEV);
const pg = modelSection(PG);

if (dev === pg) {
  console.log(
    "✅ Skema Prisma sinkron: model schema.prisma == schema.postgres.prisma"
  );
  process.exit(0);
}

console.error("❌ Skema Prisma TIDAK sinkron!");
console.error("   Model di prisma/schema.prisma dan prisma/schema.postgres.prisma");
console.error("   berbeda — fitur baru belum dicerminkan di varian Postgres.");
const devLines = dev.split("\n");
const pgLines = pg.split("\n");
const max = Math.max(devLines.length, pgLines.length);
for (let i = 0; i < max; i++) {
  if (devLines[i] !== pgLines[i]) {
    console.error(`   baris ${i + 1}:`);
    console.error(`     schema.prisma        : ${devLines[i] ?? "(akhir file)"}`);
    console.error(`     schema.postgres.prisma: ${pgLines[i] ?? "(akhir file)"}`);
    break;
  }
}
process.exit(1);
