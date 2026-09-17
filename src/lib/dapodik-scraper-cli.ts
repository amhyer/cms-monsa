#!/usr/bin/env node
import { runDapodikScraper } from "./dapodik-scraper";

// Kredensial TIDAK di-hardcode di source — selalu wajib dari environment
// variable (DAPODIK_USERNAME / DAPODIK_PASSWORD). Lihat README scraper.

async function main() {
  const username = process.env.DAPODIK_USERNAME;
  const password = process.env.DAPODIK_PASSWORD;
  if (!username || !password) {
    console.error(
      "Kredensial tidak lengkap: set DAPODIK_USERNAME dan DAPODIK_PASSWORD lewat env var." +
        " Jangan pernah hardcode kredensial di source."
    );
    process.exit(1);
  }
  const config = {
    dapodikUrl: process.env.DAPODIK_URL || "http://localhost:5774",
    username,
    password,
    downloadDir: "./csv_files",
    headless: process.env.HEADLESS !== "false",
  };

  console.log("🕷️  Dapodik CSV Scraper");
  console.log("=".repeat(50));
  console.log(`Target: ${config.dapodikUrl}`);
  console.log(`User: ${config.username}`);
  console.log(`Output: ${config.downloadDir}`);
  console.log("=".repeat(50));

  const result = await runDapodikScraper(config);

  if (result.success) {
    console.log("\n✅ Scraping selesai!");
    for (const mod of result.modules) {
      console.log(`  ${mod.name}: ${mod.recordCount} records -> ${mod.filePath}`);
    }
    process.exit(0);
  } else {
    console.error("\n❌ Scraping gagal:", result.error);
    process.exit(1);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });