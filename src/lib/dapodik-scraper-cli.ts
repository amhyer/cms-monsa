#!/usr/bin/env node
import { runDapodikScraper } from "./dapodik-scraper";

async function main() {
  const config = {
    dapodikUrl: process.env.DAPODIK_URL || "http://localhost:5774",
    username: process.env.DAPODIK_USERNAME || "sdnungmongisidi1@gmail.com",
    password: process.env.DAPODIK_PASSWORD || "Monsajaya12*#",
    downloadDir: "./csv_files",
    headless: process.env.HEADLESS !== "false",
  };

  console.log("🕷️  Dapodik CSV Scraper");
  console.log("=".repeat(50));
  console.log(`Target: ${config.dapodikUrl}`);
  console.log(`User: ${config.username}`);
  console.log(`Output: ${config.downloadDir}`);
  console.log("=".repeat(50));

  const { runDapodikScraper } = await import("./dapodik-scraper");
  const result = await runDapodikScraper({
    dapodikUrl: process.env.DAPODIK_URL || "http://localhost:5774",
    username: process.env.DAPODIK_USERNAME || "sdnungmongisidi1@gmail.com",
    password: process.env.DAPODIK_PASSWORD || "Monsajaya12*#",
    downloadDir: "./csv_files",
    headless: true,
  });

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