#!/usr/bin/env node
/**
 * Script persiapan build: salin jembatan.mjs dan file terkait ke folder build
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.resolve(__dirname);

// File yang perlu disalin
const filesToCopy = [
  "../jembatan.mjs",
  "../config.example.ts",
  "../config.example.php",
];

console.log("📦 Mempersiapkan build...");

// Buat folder dist jika belum ada
const distDir = path.resolve(rootDir, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log("✅ Folder dist siap di:", distDir);
console.log("");
console.log("📋 Langkah build berikutnya:");
console.log("   1. npm install");
console.log("   2. npm run build:win    # untuk Windows .exe");
console.log("   3. npm run build:all    # untuk semua platform");
console.log("");
console.log("💡 File .exe akan muncul di folder dist/");
