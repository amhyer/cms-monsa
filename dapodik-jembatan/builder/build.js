#!/usr/bin/env node
/**
 * Script Build untuk Jembatan Dapodik
 * Konversi jembatan.mjs menjadi .exe standalone
 * 
 * Usage: node build.js [platform]
 *   platform: win, mac, linux, all (default: all)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const platforms = {
  win: "node18-win-x64",
  mac: "node18-macos-x64",
  linux: "node18-linux-x64",
};

const targetArg = process.argv[2] || "all";

console.log("=".repeat(60));
console.log("  Jembatan Dapodik - Build Script");
console.log("=".repeat(60));
console.log("");

// Cek apakah pkg terinstall
try {
  execSync("pkg --version", { stdio: "pipe" });
  console.log("✅ pkg ditemukan");
} catch {
  console.log("📦 Menginstall pkg...");
  execSync("npm install pkg", { stdio: "inherit", cwd: __dirname });
}

// Buat folder dist
const distDir = path.join(projectRoot, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log("");
console.log("🔨 Memulai build...");

// Tentukan target platforms
let targets;
if (targetArg === "all") {
  targets = Object.values(platforms).join(",");
} else if (platforms[targetArg]) {
  targets = platforms[targetArg];
} else {
  console.error(`❌ Platform tidak dikenal: ${targetArg}`);
  console.log("Platform yang tersedia: win, mac, linux, all");
  process.exit(1);
}

// Build command
const sourceFile = path.join(projectRoot, "jembatan.mjs");
const outputName = targetArg === "all" 
  ? "Jembatan-Dapodik" 
  : `Jembatan-Dapodik-${targetArg}`;

console.log(`📦 Source: ${sourceFile}`);
console.log(`🎯 Targets: ${targets}`);
console.log(`📁 Output: dist/${outputName}`);
console.log("");

try {
  const ext = targetArg === "win" || targetArg === "all" ? ".exe" : "";
  const outputPath = path.join(distDir, outputName + ext);
  
  execSync(`pkg "${sourceFile}" --targets ${targets} --output "${outputPath}"`, {
    stdio: "inherit",
    cwd: __dirname
  });
  
  console.log("");
  console.log("=".repeat(60));
  console.log("✅ Build berhasil!");
  console.log("=".repeat(60));
  console.log("");
  console.log("📁 File output:");
  
  if (targetArg === "all") {
    console.log("   - dist/Jembatan-Dapodik.exe (Windows)");
    console.log("   - dist/Jembatan-Dapodik-macos (macOS)");
    console.log("   - dist/Jembatan-Dapodik-linux (Linux)");
  } else {
    console.log(`   - ${outputPath}`);
  }
  
  console.log("");
  console.log("💡 Copy file yang sesuai ke PC sekolah dan jalankan!");
  
} catch (error) {
  console.error("");
  console.error("=".repeat(60));
  console.error("❌ Build GAGAL!");
  console.error("=".repeat(60));
  console.error(error.message);
  process.exit(1);
}
