#!/usr/bin/env node
/**
 * `bun run start` — menjalankan build `output: "standalone"` (server.js),
 * jalur yang sama dengan Dockerfile self-host (COPY public + COPY .next/static).
 *
 * Kenapa bukan `next start`: Next.js menolak `next start` pada build
 * standalone — `.zscripts/dev.log.err` pernah mencatat
 * `⚠ "next start" does not work with "output: standalone" configuration`
 * lalu `error: script "start" exited with code 255`.
 *
 * Yang disiapkan sebelum server naik (semuanya idempoten, dan hanya berlaku
 * sampai build berikutnya — `next build` menghapus seluruh `.next/standalone`
 * lebih dulu, lihat `copyTracedFiles` di node_modules/next/dist/build/utils.js,
 * jadi link/folder di bawah selalu dibuat ulang oleh skrip ini):
 *
 *   1. `<dist>/standalone/.next/static` → link ke `<dist>/static`.
 *      Next TIDAK menyalin `static` ke folder standalone; Dockerfile dan
 *      .zscripts/build.sh juga menyalinnya secara manual. Tanpa ini semua
 *      asset `/_next/static/*` 404.
 *   2. `<dist>/standalone/public` → link ke `public/` repo.
 *      Next menyalin snapshot `public` saat build (read-only), padahal upload
 *      runtime menulis ke `process.cwd()/public/uploads` — dan server
 *      standalone melakukan `chdir` ke folder standalone. Tanpa link ini
 *      file yang diunggah lewat mode standalone tidak terlihat oleh
 *      `next dev`/`next start` (dan sebaliknya) → beda folder uploads antar mode.
 *   3. Salin `.env*` dari root repo ke folder standalone. Next memuat env dari
 *      dir server (folder standalone), bukan root repo — tanpa salinan ini
 *      DATABASE_URL dari `.env.local` tidak terbaca server produksi lokal.
 *
 * Env:
 *   PORT          — default 3000 (sama dengan `next start -p 3000` lama)
 *   HOSTNAME      — hanya dihormati bila IP/localhost; nama mesin (nilai umum
 *                   HOSTNAME di Git Bash & GitHub Actions) dipaksa 0.0.0.0
 *                   karena `server.js` memakainya sebagai alamat bind.
 *   NEXT_DIST_DIR — distDir alternatif (default `.next`)
 */
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = process.env.NEXT_DIST_DIR || ".next";
const dist = path.join(root, distDir);
const standalone = path.join(dist, "standalone");
const serverJs = path.join(standalone, "server.js");

// ---------------------------------------------------------------------------
// 1. Cek build ada — kalau tidak, kasih pesan yang bisa ditindaklanjuti.
// ---------------------------------------------------------------------------
if (!existsSync(serverJs)) {
  if (existsSync(path.join(dist, "BUILD_ID"))) {
    // Build produksi tanpa folder standalone (mis. `output: standalone`
    // dinonaktifkan) — `next start` jalur biasa tetap sah.
    console.warn(`⚠️  ${distDir}/standalone tidak ada; memakai \`next start\` (build tanpa output standalone).`);
    const legacy = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", portFromArgs() ?? process.env.PORT ?? "3000"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    forwardSignals(legacy);
    legacy.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
  } else {
    console.error(`❌ Build produksi tidak ditemukan (${path.relative(root, serverJs)}).`);
    console.error("   Jalankan `bun run build` dulu — `bun run start` menjalankan hasil build, bukan dev mode.");
    process.exit(1);
  }
} else {
  startStandalone();
}

// ---------------------------------------------------------------------------
// 2. Mode utama: standalone server
// ---------------------------------------------------------------------------
function startStandalone() {
  const staticLink = linkDir(path.join(dist, "static"), path.join(standalone, ".next", "static"));
  const publicLink = linkDir(path.join(root, "public"), path.join(standalone, "public"));
  const envSynced = syncEnvFiles();

  const port = portFromArgs() ?? process.env.PORT ?? "3000";
  const hostname = bindHost(process.env.HOSTNAME);
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: hostname,
  };

  console.log(`🚀 standalone server: ${path.relative(root, serverJs)}`);
  console.log(`   port ${port} · bind ${hostname} · static=${staticLink} · public=${publicLink} · env=${envSynced}`);

  const child = spawn(process.execPath, [serverJs], {
    cwd: standalone,
    stdio: "inherit",
    env,
  });
  forwardSignals(child);
  child.on("error", (err) => {
    console.error(`❌ Gagal menjalankan server standalone: ${err.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
}

/**
 * Ganti folder biasa dengan junction (Windows, tanpa admin) / symlink (POSIX)
 * yang menunjuk ke sumber asli. Bila link gagal dibuat, jatuh ke salinan biasa
 * supaya server tetap naik (kompromi: upload runtime tidak lagi satu folder).
 * Nilai kembalian dipakai untuk log: ok (sudah benar) | linked | copied.
 */
function linkDir(target, linkPath) {
  let stat = null;
  try {
    stat = lstatSync(linkPath);
  } catch {
    /* belum ada */
  }

  if (stat?.isSymbolicLink()) {
    const current = readlinkSync(linkPath).replace(/[\\/]+$/, "");
    if (path.resolve(current) === path.resolve(target)) return "ok";
    rmSync(linkPath, { recursive: true, force: true });
  } else if (stat) {
    rmSync(linkPath, { recursive: true, force: true });
  }

  try {
    mkdirSync(path.dirname(linkPath), { recursive: true });
    // 'junction' hanya berlaku di Windows (direktori, tanpa hak admin);
    // di POSIX diabaikan Node dan jadi symlink biasa.
    symlinkSync(target, linkPath, "junction");
    return "linked";
  } catch (err) {
    console.warn(`⚠️  Link ${path.relative(root, linkPath)} gagal (${err.code ?? err.message}) — fallback salin biasa.`);
    cpSync(target, linkPath, { recursive: true });
    return "copied";
  }
}

/**
 * Salin berkas `.env*` root repo → folder standalone (Next memuat env dari dir
 * server). Berkas yang sudah dihapus dari root ikut dihapus agar tidak ada
 * salinan env basi yang terbaca server.
 */
function syncEnvFiles() {
  const names = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
    ".env.development",
    ".env.development.local",
    ".env.test",
  ];
  let copied = 0;
  for (const name of names) {
    const from = path.join(root, name);
    const to = path.join(standalone, name);
    if (existsSync(from)) {
      copyFileSync(from, to);
      copied += 1;
    } else if (existsSync(to)) {
      unlinkSync(to);
    }
  }
  return `${copied} file`;
}

/**
 * `server.js` memakai `process.env.HOSTNAME` sebagai alamat bind (default
 * 0.0.0.0). HOSTNAME di Git Bash/CI berisi NAMA MESIN (mis. DESKTOP-xxx,
 * fv-az123-456) — bukan alamat yang bisa di-bind → paksa 0.0.0.0 kecuali
 * pengguna menyetel IP/localhost secara eksplisit.
 */
function bindHost(value) {
  if (!value || value === "localhost" || value === "0.0.0.0") return value || "0.0.0.0";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return value; // IPv4
  if (value.includes(":")) return value; // IPv6
  return "0.0.0.0";
}

/** `-p 3000` / `--port 3000` (paritas dengan `next start -p 3000` lama). */
function portFromArgs() {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "-p" || argv[i] === "--port") return argv[i + 1];
    const inline = argv[i].match(/^--port=(.+)$/);
    if (inline) return inline[1];
  }
  return undefined;
}

/** Teruskan sinyal ke anak (agar Ctrl+C / kill wrapper tidak meninggalkan server). */
function forwardSignals(child) {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }
}
