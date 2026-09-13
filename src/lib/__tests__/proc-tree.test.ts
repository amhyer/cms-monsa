import { describe, it, expect, vi, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectProcessTree, killProcessTree } from "../proc-tree";

const isWin = process.platform === "win32";

/** Pohon /proc palsu — hermetic, tanpa menyentuh proses nyata. */
const tempRoots: string[] = [];
const livePids: number[] = [];

function fakeProcRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "proc-tree-test-"));
  tempRoots.push(dir);
  return dir;
}

/** Tulis /proc/<pid>/{stat,cmdline} palsu. `stat` meniru format kernel. */
function writeProcEntry(
  procRoot: string,
  pid: number,
  ppid: number,
  cmdline = `node proc-${pid}.js`
): void {
  const dir = join(procRoot, String(pid));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "stat"),
    `${pid} (proc-${pid}) S ${ppid} ${ppid} 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 1 0 0 0\n`
  );
  writeFileSync(join(dir, "cmdline"), `${cmdline.split(" ").join("\0")}\0`);
}

/** Catat sinyal yang dikirim helper (seam `kill`), bukan sinyal nyata. */
function recorder(): { calls: [number, string][]; kill: (p: number, s: NodeJS.Signals) => void } {
  const calls: [number, string][] = [];
  return { calls, kill: (p, s) => calls.push([p, s]) };
}

/** Proses masih hidup? (sinyal 0 — zombie ikut terhitung hidup). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForDeath(pid: number, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!alive(pid)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !alive(pid);
}

/**
 * Jalankan node yang (a) melahirkan satu anak `sleep` dan mencetak pid anak
 * itu ke stdout, (b) menahan hidup sampai dibunuh. Opsi `ignoreTerm`
 * membuat root MENGABAIKAN SIGTERM — memaksa jalur eskalasi SIGKILL.
 */
function spawnTree(ignoreTerm: boolean): Promise<{ pid: number; childPid: number }> {
  const script = [
    ignoreTerm ? 'process.on("SIGTERM", () => {});' : "",
    'const { spawn } = require("node:child_process");',
    'const c = spawn("sleep", ["30"], { stdio: "ignore" });',
    "console.log(c.pid);",
    "setInterval(() => {}, 1_000);",
  ]
    .filter(Boolean)
    .join("\n");
  const proc = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "ignore"] });
  const pid = proc.pid as number;
  livePids.push(pid);
  return new Promise((resolve, reject) => {
    let out = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const line = out.split("\n")[0]?.trim();
      if (line && /^\d+$/.test(line)) resolve({ pid, childPid: Number(line) });
    });
    proc.on("error", reject);
    setTimeout(() => reject(new Error("timeout menunggu pid anak")), 10_000);
  });
}

afterEach(async () => {
  for (const pid of livePids.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // sudah mati.
    }
  }
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("killProcessTree — guard keselamatan", () => {
  it("menolak pid ≤ 1 (0, 1, dan pid negatif) tanpa mengirim sinyal apa pun", async () => {
    const root = fakeProcRoot();
    const { calls, kill } = recorder();

    for (const pid of [0, 1, -1, -4242]) {
      const result = await killProcessTree(pid, {
        procRoot: root,
        platform: "linux",
        kill,
        graceMs: 0,
      });
      expect(result.outcome).toBe("refused");
      expect(result.reason).toContain("pid ≤ 1");
      expect(result.tree).toEqual([]);
    }
    expect(calls).toEqual([]);
  });

  it("TIDAK PERNAH mengirim sinyal ke PID negatif (regresi `cancelled` di CI)", async () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 4243, 2);
    const spy = vi.spyOn(process, "kill").mockImplementation(() => true as never);

    // Bentuk lama yang berbahaya: `process.kill(-pid, 'SIGTERM')`.
    const result = await killProcessTree(-4243, {
      procRoot: root,
      platform: "linux",
      graceMs: 0,
    });

    expect(result.outcome).toBe("refused");
    expect(spy).not.toHaveBeenCalled();
    for (const [pid] of spy.mock.calls) {
      // Sinyal grup = pid negatif; helper ini tidak boleh pernah memakainya.
      expect(Number(pid)).toBeGreaterThan(1);
    }
    spy.mockRestore();
  });

  it("menolak pid proses ini sendiri", async () => {
    const root = fakeProcRoot();
    const { calls, kill } = recorder();

    const result = await killProcessTree(process.pid, {
      procRoot: root,
      platform: "linux",
      kill,
      graceMs: 0,
    });

    expect(result.outcome).toBe("refused");
    expect(result.reason).toContain("sendiri atau leluhurnya");
    expect(calls).toEqual([]);
  });

  it("menolak pid leluhur pemanggil (process.ppid)", async () => {
    const root = fakeProcRoot();
    // Proses ini → ppid (keduanya ada di pohon /proc palsu).
    writeProcEntry(root, process.pid, process.ppid);
    writeProcEntry(root, process.ppid, 2);
    const { calls, kill } = recorder();

    const result = await killProcessTree(process.ppid, {
      procRoot: root,
      platform: "linux",
      kill,
      graceMs: 0,
    });

    expect(result.outcome).toBe("refused");
    expect(result.reason).toContain("sendiri atau leluhurnya");
    expect(calls).toEqual([]);
  });

  it("menolak saat cmdline tidak cocok (anti PID-reuse) dan proses dibiarkan hidup", async () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 5150, 2, "npm run some-other-service");
    const { calls, kill } = recorder();

    const result = await killProcessTree(5150, {
      procRoot: root,
      platform: "linux",
      kill,
      expectCmdline: "bun run dev",
      graceMs: 0,
    });

    expect(result.outcome).toBe("refused");
    expect(result.reason).toContain("anti PID-reuse");
    expect(calls).toEqual([]);
  });

  it("menerima cmdline yang cocok lalu mengirim sinyal satu per satu (bukan sinyal grup)", async () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 5150, 2, "bun run dev --port 3000");
    writeProcEntry(root, 5151, 5150, "next dev -p 3000");
    writeProcEntry(root, 5152, 5151, "next-server (v16.3.3)");
    const { calls, kill } = recorder();

    const result = await killProcessTree(5150, {
      procRoot: root,
      platform: "linux",
      kill,
      expectCmdline: /bun run dev/,
      graceMs: 0,
    });

    expect(result.outcome).toBe("signaled");
    // Terdalam dulu, root terakhir — anak tidak sempat di-respawn orang tua.
    expect(calls.map(([pid]) => pid)).toEqual([5152, 5151, 5150]);
    expect(calls.every(([, sig]) => sig === "SIGTERM")).toBe(true);
    expect(calls.every(([pid]) => pid > 1)).toBe(true);
  });
});

describe("collectProcessTree — penelusuran rantai ppid /proc", () => {
  it("mengumpulkan keturunan TERDALAM dulu dengan root paling akhir", () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 100, 2);
    writeProcEntry(root, 101, 100);
    writeProcEntry(root, 102, 101);
    writeProcEntry(root, 103, 100);

    const tree = collectProcessTree(100, root);

    expect(tree.at(-1)).toBe(100); // root terakhir.
    expect(tree.slice(0, -1).sort((a, b) => a - b)).toEqual([101, 102, 103]);
    expect(tree.indexOf(102)).toBeLessThan(tree.indexOf(101)); // cucu sebelum anak.
  });

  it("hanya memasukkan keturunan root — proses lain diabaikan", () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 200, 2);
    writeProcEntry(root, 201, 200);
    writeProcEntry(root, 300, 2); // keluarga lain (mis. runner CI).
    writeProcEntry(root, 301, 300);
    writeProcEntry(root, 1, 0, "/sbin/init");

    const tree = collectProcessTree(200, root);

    expect(tree.sort((a, b) => a - b)).toEqual([200, 201]);
    expect(tree).not.toContain(300);
    expect(tree).not.toContain(301);
    expect(tree).not.toContain(1);
  });

  it("mengabaikan entri /proc yang rusak atau tidak bisa dibaca", () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 400, 2);
    writeProcEntry(root, 401, 400);
    // Entri rusak: tanpa kolom ppid, ppid non-numerik, dan bukan direktori pid.
    mkdirSync(join(root, "402"), { recursive: true });
    writeFileSync(join(root, "402", "stat"), "402 (rusak) S\n");
    writeProcEntry(root, 403, Number.NaN);
    mkdirSync(join(root, "sys"), { recursive: true });

    const tree = collectProcessTree(400, root);

    expect(tree.sort((a, b) => a - b)).toEqual([400, 401]);
  });

  it("tidak terjebak siklus ppid dan tetap mengembalikan root", () => {
    const root = fakeProcRoot();
    writeProcEntry(root, 500, 501); // siklus: 500 ↔ 501.
    writeProcEntry(root, 501, 500);
    writeProcEntry(root, 502, 500);

    const tree = collectProcessTree(500, root);

    expect(tree.at(-1)).toBe(500);
    expect(tree).toContain(502);
    expect(tree.length).toBeLessThanOrEqual(3);
  });
});

describe("killProcessTree — eksekusi proses nyata", () => {
  it.skipIf(isWin)("membunuh proses nyata beserta anaknya (LIVE)", async () => {
    const { pid, childPid } = await spawnTree(false);
    expect(alive(childPid)).toBe(true);

    const result = await killProcessTree(pid, { graceMs: 500 });

    expect(result.outcome).toBe("signaled");
    expect(result.tree.at(-1)).toBe(pid);
    expect(result.tree).toContain(childPid);
    // Anak juga mati — bukan hanya pemilik pid (bukti "pohon", bukan satu PID).
    expect(await waitForDeath(pid)).toBe(true);
    expect(await waitForDeath(childPid)).toBe(true);
    livePids.splice(livePids.indexOf(pid), 1);
  });

  it.skipIf(isWin)("mengeskalasi ke SIGKILL ketika SIGTERM diabaikan (LIVE)", async () => {
    const { pid, childPid } = await spawnTree(true);
    const logs: string[] = [];

    const result = await killProcessTree(pid, {
      graceMs: 300,
      log: (m) => logs.push(m),
    });

    expect(result.outcome).toBe("signaled");
    expect(logs.some((m) => m.includes("eskalasi SIGKILL"))).toBe(true);
    expect(await waitForDeath(pid)).toBe(true);
    expect(await waitForDeath(childPid)).toBe(true);
    livePids.splice(livePids.indexOf(pid), 1);
  });

  it.skipIf(isWin)("melaporkan not-found untuk pid yang sudah mati (tanpa melempar)", async () => {
    const proc = spawn("sleep", ["30"], { stdio: "ignore" });
    const pid = proc.pid as number;
    process.kill(pid, "SIGKILL");
    await new Promise((r) => proc.on("exit", r));

    const result = await killProcessTree(pid, { graceMs: 0 });

    expect(result.outcome).toBe("not-found");
    expect(result.signaled).toEqual([]);
    expect(result.reason).toContain("sudah tidak ada");
  });
});
