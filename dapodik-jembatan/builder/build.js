#!/usr/bin/env node
/**
 * Build Jembatan Dapodik executable standalone (bun build --compile).
 *
 * Usage: node build.js [platform]
 *   platform: win, mac, linux, all (default: all)
 *
 * Prasyarat: bun terinstall (project ini memakai bun — lihat bun.lock).
 * Hasil: dist/Jembatan-Dapodik.exe (Windows), -macos, -linux.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, ".."); // dapodik-jembatan/
const distDir = path.join(rootDir, "dist");
const entry = path.join(rootDir, "jembatan.mjs");

const PLATFORMS = {
  win: { target: "bun-windows-x64", out: "Jembatan-Dapodik.exe" },
  mac: { target: "bun-darwin-x64", out: "Jembatan-Dapodik-macos" },
  linux: { target: "bun-linux-x64", out: "Jembatan-Dapodik-linux" },
};

const arg = process.argv[2] || "all";
const platforms = arg === "all" ? Object.keys(PLATFORMS) : [arg];
const unknown = platforms.filter((p) => !PLATFORMS[p]);
if (unknown.length) {
  console.error(`❌ Platform tidak dikenal: ${unknown.join(", ")}`);
  console.error("   Pilihan: win, mac, linux, all");
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });

for (const p of platforms) {
  const { target, out } = PLATFORMS[p];
  const outfile = path.join(distDir, out);
  console.log(`\n🔨 Build ${p} (${target})`);
  execSync(
    `bun build --compile --minify --target ${target} "${entry}" --outfile "${outfile}"`,
    { stdio: "inherit", cwd: rootDir }
  );
  console.log(`✅ ${outfile}`);
}

console.log("\nSelesai. Salin file yang sesuai ke PC sekolah (lihat README-OPERATOR.md).");