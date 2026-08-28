import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// warmup: POST /api/bos-documents DELETE /api/bos-documents /api/bos-documents /api/csrf-token /api/auth/login

/**
 * Persistensi disk: unggah dokumen BOS → RESTART server → file tetap bisa
 * diunduh dengan byte identik. Membuktikan dokumen disimpan di disk
 * (public/uploads + SQLite), bukan di memori proses server.
 *
 * WAJIB berjalan TERAKHIR (prefix `zz`): test ini mematikan dan menyalakan
 * server dev di tengah run — server baru itu dingin, jadi spec setelahnya
 * akan kena cold-compile. Dengan workers:1 + urutan abjad file, `zz-*`
 * adalah spec terakhir.
 *
 * Pengaman:
 *   - Hanya berjalan pada run yang dikontrol wrapper (E2E_BASE_URL +
 *     E2E_PORT diset) — jangan pernah menyalakan ulang server sembarang.
 *   - DILEWATI bila .zscripts/dev.pid ada (reuse mode: server milik
 *     developer sedang hidup) — tidak mematikan server orang.
 *
 * Session & CSRF bertahan lintas restart: SESSION_SECRET memakai dev
 * fallback deterministik (tanpa AUTH_SECRET) dan CSRF adalah cookie-vs-header
 * tanpa secret server — jadi login admin tetap valid setelah server baru naik.
 */
const baseURL = process.env.E2E_BASE_URL ?? "";
const port = baseURL ? new URL(baseURL).port || "3000" : "";
const controlledRun = Boolean(baseURL && port);
const reuseDevServer = existsSync(join(process.cwd(), ".zscripts", "dev.pid"));

const isWin = process.platform === "win32";

/** PID yang sedang mendengarkan di port server e2e (bisa lebih dari satu). */
function portPids(): number[] {
  if (!isWin) {
    // CI (ubuntu) — `ss` selalu ada; lsof tidak dijamin. Output seperti
    // `users:(("node",pid=1234,fd=23))`.
    const res = spawnSync("ss", ["-ltnp", `sport = :${port}`], {
      encoding: "utf8",
      timeout: 10_000,
    });
    const text = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
    const pids = new Set<number>();
    for (const m of text.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));
    return [...pids];
  }
  const res = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    ],
    { encoding: "utf8", timeout: 20_000 }
  );
  return (res.stdout ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number);
}

/**
 * Matikan pohon server e2e (next dev + child start-server). Menyerang hanya
 * pemilik port TIDAK cukup: `next dev` memulai ulang server child-nya
 * (observasi live: pid baru langsung mendengarkan ulang).
 *
 * Target = proses `next dev` itu sendiri (node.exe dengan cmdline berisi
 * "next" + "dev" namun BUKAN "start-server"): taskkill /T pada launcher
 * mematikan start-server child-nya sekaligus, dan karena launcher-nya mati,
 * tidak ada respawn.
 *
 * PENTING — JANGAN menyerang leluhur TERTINGGI: di bawah wrapper, rantai
 * dari port owner menembus keluarga wrapper itu sendiri (cmd.exe → bun →
 * powershell/bash host). taskkill /T pada leluhur tinggi mematikan wrapper +
 * Playwright sekaligus (observasi live: wrapper hilang tanpa verdict — log
 * berhenti di [82/82]). Cari `next dev` dari BAWAH (terdekat port owner),
 * jadi kill tidak pernah menembus keluarga server.
 */
function killServerTree(portOwnerPid: number): void {
  if (!isWin) {
    // PID dari `ss` belum tentu group leader — coba pid dulu, lalu process
    // group (negatif) sebagai fallback. Keduanya diabaikan bila sudah mati.
    for (const target of [portOwnerPid, -portOwnerPid]) {
      try {
        process.kill(target, "SIGTERM");
      } catch {
        // proses sudah tidak ada / bukan group leader
      }
    }
    return;
  }
  // Catatan escaping: template literal TS — kutip ganda untuk -Filter TIDAK
  // perlu di-escape (backslash justru merusak filter PowerShell).
  // Format tiap baris: NAMA:PID:CMD (CommandLine bisa mengandung ":", jadi
  // hanya dua titik dua PERTAMA yang dipakai sebagai pemisah).
  const res = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$p = ${portOwnerPid}; $out = @(); for ($i=0; $i -lt 6 -and $p -gt 0; $i++) { $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue; if (-not $proc) { break }; $out += "$($proc.Name):$($proc.ProcessId):$($proc.CommandLine)"; $p = $proc.ParentProcessId }; $out`,
    ],
    { encoding: "utf8", timeout: 20_000 }
  );
  const chain = (res.stdout ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((e) => {
      const c1 = e.indexOf(":");
      const c2 = e.indexOf(":", c1 + 1);
      return {
        name: e.slice(0, c1),
        pid: Number(e.slice(c1 + 1, c2)),
        cmd: e.slice(c2 + 1),
      };
    });
  // Dari BAWAH (terdekat port owner): node.exe launcher `next dev` (bukan
  // start-server). Bila tidak ketemu, jatuh ke port owner itu sendiri.
  const launcher =
    chain.find(
      (p) =>
        p.pid > 0 &&
        p.name === "node.exe" &&
        /next/.test(p.cmd) &&
        /\bdev\b/.test(p.cmd) &&
        !/start-server/.test(p.cmd)
    ) ?? chain[0];
  const top = launcher?.pid ?? portOwnerPid;
  if (top > 0) {
    // Path PENUH taskkill.exe — Git Bash (yang mewarisi PATH ke proses test)
    // TIDAK memuat System32, jadi `taskkill` polos tidak ditemukan dan kill
    // gagal diam-diam (observasi live: port tetap hidup, test hang di loop).
    const taskkill = join(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "taskkill.exe"
    );
    const r = spawnSync(taskkill, ["/pid", String(top), "/T", "/F"], {
      stdio: "pipe",
      timeout: 15_000,
    });
    if (r.error || r.status !== 0) {
      console.warn(
        `[restart] taskkill ${top} gagal: ${String(r.error ?? r.stderr)}`
      );
    }
  }
}

function startServer(): void {
  const stamp = Date.now();
  const logOut = join(tmpdir(), `monsa-restart-${stamp}.log`);
  const logErr = `${logOut}.err`;
  // Env DIWARISI dari proses test (wrapper sudah menetapkan DATABASE_URL +
  // NEXT_DIST_DIR) agar server baru memakai DB dan distDir yang SAMA.
  //
  // PENTING (Windows): spawn langsung `npm.cmd`/`cmd.exe` dari Node TIDAK
  // bekerja di lingkungan ini (System32 tak ada di PATH Windows → EINVAL /
  // ENOENT; detached cmd malah tidak pernah menyalakan server). Solusi yang
  // TERBUKTI (dipakai sepanjang sesi untuk server scratch): PowerShell
  // Start-Process dengan redirect stdout/stderr ke file terpisah, hidden.
  //
  // Jangan lewat `npm run dev`: skrip dev package.json menyuntik `-p 3000`,
  // sehingga perintah jadi `next dev -p 3000 -p ${port}` — Next.js mendeteksi
  // server dev lain yang sudah jalan di :3000 dan langsung menolak naik
  // ("Another next dev server is already running"). Panggil binary `next`
  // LANGSUNG lewat node.exe (process.execPath — pasti resolve) + port flag
  // tunggal. Env DIWARISI agar DB + distDir sama dengan server asli.
  if (isWin) {
    const nextBin = "node_modules/next/dist/bin/next";
    // distDir WAJIB beda dari server dev utama developer (yang biasanya
    // memakai `.next` default): Next.js menolak dua `next dev` yang berbagi
    // distDir yang sama di proyek yang sama ("Another next dev server is
    // already running"). Bila wrapper tidak menyetel NEXT_DIST_DIR (mis. uji
    // standalone), pakai `.next-gate` — pola yang sama seperti server e2e.
    const distDir = process.env.NEXT_DIST_DIR || ".next-gate";
    const ps = spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$env:DATABASE_URL='${process.env.DATABASE_URL ?? ""}'; $env:NEXT_DIST_DIR='${distDir}'; (Start-Process -FilePath '${process.execPath}' -ArgumentList '${nextBin}','dev','-p','${port}' -RedirectStandardOutput '${logOut}' -RedirectStandardError '${logErr}' -WindowStyle Hidden -PassThru).Id`,
      ],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
    ps.unref();
    return;
  }
  spawn("bun", ["x", "next", "dev", "-p", port], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  }).unref();
}

async function waitForServer(timeoutMs = 180_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseURL, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status === 200) return true;
    } catch {
      // belum naik — lanjut polling
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return false;
}

test.skip(!controlledRun || reuseDevServer, "hanya pada run yang dikontrol wrapper (bukan reuse dev server)");

test("dokumen BOS bertahan di disk lintas restart server (upload → restart → unduh)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/transparansi");
  await expect(page.getByRole("button", { name: "Tambah Belanja" })).toBeVisible();
  await page.getByRole("tab", { name: "Dokumen (PDF)" }).click();

  // --- UPLOAD (siklus normal) ---
  const marker = `E2E-BOS-RESTART-${Date.now()}`;
  const pdf = Buffer.from(
    `%PDF-1.7\n%${marker}\n1 0 obj\n<< /Title (${marker}) >>\nendobj\ntrailer\n<<>>\n%%EOF\n`
  );
  const title = `Output ARKAS restart ${Date.now()}`;
  await page.getByLabel("Tahun Anggaran").fill("2026");
  await page.getByLabel("Judul Dokumen").fill(title);
  await page.setInputFiles('input[type="file"]', {
    name: "restart.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText("Dokumen diunggah dan dipublikasikan.")).toBeVisible();

  const fileUrl = await page.evaluate<string | null>(async (t) => {
    const r = await fetch("/api/bos-documents");
    const d = await r.json();
    const item = d.items.find((i: { title: string }) => i.title === t);
    return item ? item.fileUrl : null;
  }, title);
  expect(fileUrl).toMatch(/^\/uploads\/bos-[\w-]+\.pdf$/);
  const diskPath = join(
    process.cwd(),
    "public",
    "uploads",
    (fileUrl as string).split("/").pop() as string
  );
  expect(existsSync(diskPath)).toBe(true);

  // Baseline SEBELUM restart — unduh via endpoint, byte identik + header
  // Content-Disposition attachment (kontrak unduh yang sama dengan
  // bos-document-cycle.spec.ts).
  const docId = await page.evaluate<string | null>(async (t) => {
    const r = await fetch("/api/bos-documents");
    const d = await r.json();
    const item = d.items.find((i: { title: string }) => i.title === t);
    return item ? item.id : null;
  }, title);
  expect(docId).toBeTruthy();
  const downloadUrl = `/api/bos-documents/${docId}`;
  const before = await page.request.get(downloadUrl);
  expect(before.status()).toBe(200);
  expect(before.headers()["content-disposition"] ?? "").toContain("attachment");
  expect(Buffer.from(await before.body()).equals(pdf)).toBe(true);

  // --- RESTART SERVER (setelah upload, sebelum hapus) ---
  const pids = portPids();
  expect(pids.length).toBeGreaterThan(0);
  // Bunuh pohon utuh (bukan hanya pemilik port) — next dev merespawn
  // server child bila pemilik port saja yang dibunuh.
  for (const pid of pids) killServerTree(pid);
  // Tunggu port benar-benar bebas; kalau masih ada listener (respawn edge),
  // bunuh pohonnya lagi — maks 3 putaran.
  let freed = false;
  for (let round = 0; round < 3 && !freed; round++) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && portPids().length > 0) {
      await new Promise((r) => setTimeout(r, 1_000));
    }
    const left = portPids();
    if (left.length === 0) {
      freed = true;
    } else {
      for (const pid of left) killServerTree(pid);
    }
  }
  expect(freed).toBe(true);
  startServer();
  expect(await waitForServer()).toBe(true);

  // --- UNDUH SETELAH RESTART: byte harus PERSIS sama (bukti disk) ---
  const after = await page.request.get(downloadUrl);
  expect(after.status()).toBe(200);
  expect(after.headers()["content-disposition"] ?? "").toContain("attachment");
  const afterBytes = Buffer.from(await after.body());
  expect(afterBytes.equals(pdf)).toBe(true);

  // API juga masih memuat dokumennya (server baru, DB yang sama).
  const listed = await page.evaluate<boolean>(async (t) => {
    const r = await fetch("/api/bos-documents");
    const d = await r.json();
    return (d.items as { title: string }[]).some((i) => i.title === t);
  }, title);
  expect(listed).toBe(true);

  // --- CLEANUP: hapus via API (session + CSRF bertahan lintas restart) ---
  await page.evaluate(async (t) => {
    const csrf = await (await fetch("/api/csrf-token")).json();
    const r = await fetch("/api/bos-documents");
    const d = await r.json();
    const item = (d.items as { id: string; title: string }[]).find(
      (i) => i.title === t
    );
    if (item) {
      await fetch(`/api/bos-documents/${item.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf.token },
      });
    }
  }, title);

  expect(existsSync(diskPath)).toBe(false);
  const old = await page.request.get(downloadUrl);
  expect(old.status()).toBe(404);
});
