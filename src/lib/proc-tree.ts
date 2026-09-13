/**
 * proc-tree.ts — hentikan pohon proses dengan AMAN (tanpa PID negatif).
 *
 * LATAR MASALAH (akar `Run E2E tests` → `cancelled` di CI):
 * wrapper E2E (scripts/run-e2e.ts) dan spec restart server
 * (e2e/zz-server-restart-persistence.spec.ts) dulu memakai
 * `process.kill(-pid, "SIGTERM")` untuk "mematikan seluruh grup proses".
 * PID negatif = sinyal ke SELURUH process group — dan PID yang dikirim
 * bukan pemimpin grup: PID port-owner dari `ss` (spec restart) maupun PID
 * basi pasca-restart (wrapper, setelah server menyala lagi). Di container
 * CI yang PID-nya padat, sinyal itu menghantam grup milik runner GitHub
 * Actions, yang menafsirkannya sebagai perintah cancel — job mati sebagai
 * `cancelled` (anotasi "The operation was canceled") tanpa log sama sekali.
 *
 * Helper ini TIDAK PERNAH memakai PID negatif. Yang diberi sinyal hanya:
 *   1. proses root itu sendiri, dan
 *   2. keturunannya yang ditemukan dari rantai ppid di /proc,
 * diurutkan dari yang TERDALAM dulu — satu sinyal per PID (bukan sinyal
 * grup), jadi tidak mungkin menembus keluarga proses lain.
 *
 * Pengaman (semua menolak TANPA menyentuh proses):
 *   - pid ≤ 1 — termasuk PID negatif (sinyal grup), PID 0 (semua proses
 *     milik user yang sama), dan PID 1 (init).
 *   - pid = proses ini sendiri atau LELUHURNya (mis. shell pemanggil,
 *     wrapper, atau runner CI).
 *   - cmdline root tidak cocok dengan `expectCmdline` → PID sudah didaur
 *     ulang proses lain (PID reuse); lebih baik tidak dibunuh.
 *
 * Eskalasi: sinyal awal (default SIGTERM) ke semua PID → tunggu `graceMs`
 * → SIGKILL hanya untuk yang masih hidup. Semua kegagalan sinyal ditelan
 * (ESRCH = proses sudah hilang); fungsi ini tidak pernah melempar.
 *
 * Dependency-free: hanya modul bawaan Node (`node:fs`, `node:child_process`).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Batas ukuran pohon yang ditelusuri (jaga-jaga /proc rusak/cabang ekstrem). */
const MAX_TREE_SIZE = 4096;
/** Batas kedalaman rantai keturunan (proteksi siklus ppid). */
const MAX_DEPTH = 64;
/** Jeda default sebelum eskalasi SIGKILL (ms). */
const DEFAULT_GRACE_MS = 2_000;
/** Timeout taskkill (Windows) — spawnSync TIDAK boleh menggantung. */
const TASKKILL_TIMEOUT_MS = 15_000;

/** Cara mengirim sinyal ke SATU pid (selalu positif). */
export type SendSignal = (pid: number, signal: NodeJS.Signals) => void;

export interface KillProcessTreeOptions {
  /** Sinyal awal (default "SIGTERM"). "SIGKILL" melewati fase kasih tempo. */
  signal?: NodeJS.Signals;
  /** Jeda (ms) sebelum eskalasi SIGKILL ke proses yang masih hidup (default 2000). */
  graceMs?: number;
  /**
   * Guard anti PID-reuse: cmdline proses root (isi /proc/<pid>/cmdline,
   * byte NUL → spasi) harus cocok. Regex (diuji), string (substring,
   * case-sensitive), atau predikat. Tidak cocok → penolakan; proses TIDAK
   * disentuh.
   */
  expectCmdline?: RegExp | string | ((cmdline: string) => boolean);
  /** Direktori /proc — seam uji untuk pohon palsu. Default "/proc". */
  procRoot?: string;
  /** Platform override (seam uji). Default process.platform. */
  platform?: NodeJS.Platform;
  /** Logger opsional — wrapper e2e memakai ini agar keputusan terlihat di CI. */
  log?: (message: string) => void;
  /** Sink sinyal (seam uji). Default: `process.kill(pid, signal)`. */
  kill?: SendSignal;
}

/**
 * Hasil akhir:
 *   - "signaled"  — minimal satu proses menerima sinyal (normalnya seluruh pohon).
 *   - "not-found" — root sudah tidak ada (atau taskkill Windows gagal).
 *   - "refused"   — guard menolak; TIDAK ada sinyal yang dikirim.
 */
export type KillTreeOutcome = "signaled" | "not-found" | "refused";

export interface KillTreeResult {
  /** Hasil akhir — lihat KillTreeOutcome. */
  outcome: KillTreeOutcome;
  /** PID yang menerima sinyal, urut eksekusi (terdalam dulu, root terakhir). */
  signaled: number[];
  /** PID yang dipilih sebagai target, urut eksekusi (kosong bila ditolak). */
  tree: number[];
  /** Alasan penolakan / ketiadaan — untuk log. */
  reason?: string;
}

/** Baca ppid dari /proc/<pid>/stat (field ke-2 setelah kurung tutup terakhir). */
function readPpid(pid: number, procRoot: string): number | null {
  let stat: string;
  try {
    stat = readFileSync(join(procRoot, String(pid), "stat"), "utf8");
  } catch {
    return null; // proses hilang / stat tidak terbaca (race) — abaikan.
  }
  // comm bisa memuat spasi dan tanda kurung (`(my (weird) name)`) — karena
  // itu pemisah field yang benar adalah kurung tutup TERAKHIR.
  const close = stat.lastIndexOf(")");
  if (close < 0) return null;
  const fields = stat.slice(close + 1).trim().split(/\s+/);
  // Setelah ")": state ppid pgrp session ... → ppid = fields[1].
  const ppid = Number(fields[1]);
  return Number.isInteger(ppid) && ppid >= 0 ? ppid : null;
}

/** Baca cmdline proses (byte NUL → spasi). null bila tidak terbaca. */
function readCmdline(pid: number, procRoot: string): string | null {
  try {
    return readFileSync(join(procRoot, String(pid), "cmdline"), "utf8")
      .replace(/\0/g, " ")
      .trim();
  } catch {
    return null;
  }
}

/** Apakah pid ada? Di Linux cukup keberadaan /proc/<pid>; selain itu sinyal 0. */
function processExists(
  pid: number,
  procRoot: string,
  platform: NodeJS.Platform
): boolean {
  if (platform === "linux") return existsSync(join(procRoot, String(pid)));
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = proses ada tapi bukan milik kita.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Rantai pid → leluhur (termasuk `from` sendiri), dipakai untuk menolak
 * pid milik diri sendiri / keluarga pemanggil. Dibatasi MAX_DEPTH agar
 * ppid yang bersiklus (teoretis) tidak membuat loop tak berujung.
 */
function ancestorChain(from: number, procRoot: string): number[] {
  const chain: number[] = [];
  const seen = new Set<number>();
  let current = from;
  while (current > 1 && !seen.has(current) && chain.length < MAX_DEPTH) {
    seen.add(current);
    chain.push(current);
    const parent = readPpid(current, procRoot);
    if (parent == null || parent === current) break;
    current = parent;
  }
  return chain;
}

/** Cocokkan cmdline root dengan `expectCmdline`. Tanpa opsi → selalu true. */
function cmdlineMatches(
  cmdline: string,
  expect: RegExp | string | ((cmdline: string) => boolean)
): boolean {
  if (typeof expect === "string") return cmdline.includes(expect);
  if (typeof expect === "function") return expect(cmdline);
  return expect.test(cmdline);
}

/**
 * Kumpulkan root + seluruh keturunannya dari rantai ppid /proc, urut
 * eksekusi kill: TERDALAM dulu, root paling akhir (anak tidak sempat
 * di-respawn orang tua yang masih hidup). Pid yang tidak terbaca
 * (hilang/race) dan cabang di luar keturunan root diabaikan.
 */
export function collectProcessTree(rootPid: number, procRoot = "/proc"): number[] {
  let entries: string[];
  try {
    entries = readdirSync(procRoot);
  } catch {
    return [rootPid]; // tanpa /proc: hanya root yang bisa ditarget.
  }

  const childrenOf = new Map<number, number[]>();
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue; // `self`, `thread-self`, `sys`, dll.
    const pid = Number(entry);
    const ppid = readPpid(pid, procRoot);
    if (ppid == null || ppid === pid) continue;
    const siblings = childrenOf.get(ppid);
    if (siblings) siblings.push(pid);
    else childrenOf.set(ppid, [pid]);
  }

  const order: number[] = [];
  const seen = new Set<number>([rootPid]);
  const walk = (pid: number, depth: number): void => {
    if (depth >= MAX_DEPTH) return;
    for (const child of childrenOf.get(pid) ?? []) {
      if (seen.has(child) || order.length >= MAX_TREE_SIZE) continue;
      seen.add(child);
      walk(child, depth + 1);
      order.push(child); // post-order: keturunan lebih dulu.
    }
  };
  walk(rootPid, 0);
  order.push(rootPid);
  return order;
}

/** Default sink sinyal — pid di sini dijamin > 1 (lihat guard di killProcessTree). */
function defaultSendSignal(pid: number, signal: NodeJS.Signals): void {
  process.kill(pid, signal);
}

/** Kirim satu sinyal ke banyak pid; ESRCH (sudah hilang) ditelan. */
function signalPids(
  pids: number[],
  signal: NodeJS.Signals,
  send: SendSignal,
  log: (message: string) => void
): number[] {
  const signaled: number[] = [];
  for (const pid of pids) {
    try {
      send(pid, signal);
      signaled.push(pid);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ESRCH") {
        log(`gagal mengirim ${signal} ke pid ${pid}: ${String(err)}`);
      }
    }
  }
  return signaled;
}

/** Potong cmdline panjang untuk pesan log. */
function shortCmdline(cmdline: string): string {
  return cmdline.length > 160 ? `${cmdline.slice(0, 157)}...` : cmdline;
}

/** Windows: taskkill /T /F (tidak ada /proc; PID tetap positif). */
function killWindowsTree(
  pid: number,
  log: (message: string) => void
): KillTreeResult {
  // Path PENUH taskkill.exe tidak dipaksa di sini — pemanggil Windows
  // (scripts/run-e2e.ts) mewarisi PATH cmd/PowerShell normal. Timeout wajib:
  // spawnSync taskkill bisa menggantung dan memblokir exit wrapper.
  const res = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
    stdio: "pipe",
    timeout: TASKKILL_TIMEOUT_MS,
  });
  if (res.error) {
    const reason = `taskkill pid ${pid} gagal: ${String(res.error)}`;
    log(reason);
    return { outcome: "not-found", signaled: [], tree: [pid], reason };
  }
  if (res.status !== 0) {
    const reason = `taskkill pid ${pid} exit ${String(res.status)}: ${String(
      res.stderr ?? ""
    ).trim()}`;
    log(reason);
    return { outcome: "not-found", signaled: [], tree: [pid], reason };
  }
  return { outcome: "signaled", signaled: [pid], tree: [pid] };
}

/**
 * Hentikan pohon proses milik `pid` — root + keturunannya, terdalam dulu,
 * SIGTERM individual lalu eskalasi SIGKILL. Tidak pernah memakai PID
 * negatif dan tidak pernah melempar; penolakan dilaporkan lewat
 * `result.outcome === "refused"` + `result.reason`.
 */
export async function killProcessTree(
  pid: number,
  options: KillProcessTreeOptions = {}
): Promise<KillTreeResult> {
  const platform = options.platform ?? process.platform;
  const procRoot = options.procRoot ?? "/proc";
  const log = options.log ?? (() => {});
  const graceMs = Math.max(0, options.graceMs ?? DEFAULT_GRACE_MS);
  const signal = options.signal ?? "SIGTERM";
  const send = options.kill ?? defaultSendSignal;

  // 1) Guard pid: tolak PID negatif (sinyal grup — akar masalah CI), 0, dan 1.
  if (!Number.isInteger(pid) || pid <= 1) {
    const reason =
      `pid ${String(pid)} ditolak (pid ≤ 1) — PID negatif (sinyal grup) ` +
      `TIDAK PERNAH dipakai; sasaran harus pid proses positif`;
    log(reason);
    return { outcome: "refused", signaled: [], tree: [], reason };
  }

  // 2) Guard keluarga: jangan pernah membunuh diri sendiri / leluhur pemanggil.
  if (ancestorChain(process.pid, procRoot).includes(pid)) {
    const reason = `pid ${pid} adalah proses ini sendiri atau leluhurnya — dibatalkan`;
    log(reason);
    return { outcome: "refused", signaled: [], tree: [], reason };
  }

  // 3) Anti PID-reuse: cmdline root harus cocok sebelum satu sinyal pun dikirim.
  if (!processExists(pid, procRoot, platform)) {
    const reason = `pid ${pid} sudah tidak ada`;
    log(reason);
    return { outcome: "not-found", signaled: [], tree: [], reason };
  }
  if (options.expectCmdline) {
    const cmdline = readCmdline(pid, procRoot);
    if (cmdline == null) {
      const reason = `cmdline pid ${pid} tidak terbaca (proses sudah hilang)`;
      log(reason);
      return { outcome: "not-found", signaled: [], tree: [], reason };
    }
    if (!cmdlineMatches(cmdline, options.expectCmdline)) {
      const reason =
        `cmdline pid ${pid} tidak cocok (anti PID-reuse): ` +
        `"${shortCmdline(cmdline)}"`;
      log(reason);
      return { outcome: "refused", signaled: [], tree: [], reason };
    }
  }

  // 4) Windows: taskkill /T /F — tidak ada /proc untuk menelusuri keturunan.
  if (platform === "win32") return killWindowsTree(pid, log);

  // 5) Linux/Unix: telusuri keturunan dari rantai ppid, bunuh TERDALAM dulu.
  const tree = collectProcessTree(pid, procRoot);
  const signaled = signalPids(tree, signal, send, log);
  if (tree.length > 1) {
    log(`pohon pid ${pid}: ${tree.length} proses (terdalam dulu) — ${signal}.`);
  }

  // 6) Eskalasi: SIGKILL hanya untuk yang masih hidup setelah graceMs.
  if (signal !== "SIGKILL" && graceMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, graceMs));
    const survivors = tree.filter((p) => processExists(p, procRoot, platform));
    if (survivors.length > 0) {
      log(
        `${survivors.length} proses masih hidup setelah ${graceMs}ms — ` +
          `eskalasi SIGKILL (pid ${survivors.join(", ")})`
      );
      signaled.push(...signalPids(survivors, "SIGKILL", send, log));
    }
  }

  if (signaled.length === 0) {
    const reason = `tidak ada sinyal yang terkirim ke pid ${pid} (sudah tidak ada)`;
    return { outcome: "not-found", signaled, tree, reason };
  }
  return { outcome: "signaled", signaled, tree };
}
