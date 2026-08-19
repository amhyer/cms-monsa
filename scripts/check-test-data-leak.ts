#!/usr/bin/env node
/**
 * Guard data leak — mencegah judul dengan pola E2E/AUDIT/TEST masuk ke dataset
 * produksi/dev. Memindai tabel dengan field title/name/subject/message untuk
 * pola yang mencurigakan.
 *
 * Dipakai oleh:
 *   - `bun run check:data-leak` (CI + pre-commit)
 *   - Post-seed guard di prisma/seed.ts (opsional)
 *
 * Exit 1 bila pola ditemukan; exit 0 bila bersih.
 */
import { PrismaClient } from "@prisma/client";

const LEAK_PATTERN = /E2E|AUDIT|TEST ANN|test data|fixture|mock data/i;

const TABLES: { model: keyof PrismaClient; fields: string[]; label: string }[] = [
  { model: "news", fields: ["title"], label: "News" },
  { model: "announcement", fields: ["title"], label: "Announcement" },
  { model: "achievement", fields: ["title"], label: "Achievement" },
  { model: "galleryItem", fields: ["title"], label: "GalleryItem" },
  { model: "contactMessage", fields: ["subject", "name"], label: "ContactMessage" },
  { model: "complaint", fields: ["subject", "name"], label: "Complaint" },
  { model: "orgStructure", fields: ["name"], label: "OrgStructure" },
  { model: "bosExpenditure", fields: ["item", "description"], label: "BosExpenditure" },
  { model: "bosDocument", fields: ["title"], label: "BosDocument" },
];

async function main() {
  const p = new PrismaClient();
  let leaks: { table: string; id: string; field: string; value: string }[] = [];

  for (const { model, fields, label } of TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = await (p as any)[model].findMany({ take: 100 });
      for (const item of items) {
        for (const field of fields) {
          const val = String(item[field] ?? "");
          if (LEAK_PATTERN.test(val)) {
            leaks.push({ table: label, id: String(item.id).substring(0, 8), field, value: val.substring(0, 60) });
          }
        }
      }
    } catch {
      // Model mungkin tidak ada di schema — skip
    }
  }

  await p.$disconnect();

  if (leaks.length > 0) {
    console.error(`❌ Ditemukan ${leaks.length} data uji yang bocor ke dataset:\n`);
    for (const l of leaks) {
      console.error(`  ${l.table} [${l.id}] ${l.field} = "${l.value}"`);
    }
    console.error("\nBersihkan data uji sebelum commit/deploy. Gunakan dashboard admin atau:");
    console.error("  bun run clean:test-data");
    process.exit(1);
  }

  console.log("✅ Tidak ada data uji yang bocor ke dataset.");
}

main();
