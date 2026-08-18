/**
 * Statistik per-run e2e — SATU sumber kebenaran untuk skema `e2e-stats.jsonl`
 * yang dipakai wrapper (scripts/run-e2e.ts, menulis) dan cek tren non-2xx
 * (scripts/check-non2xx.ts, membaca + membandingkan antar run).
 *
 * Setiap run menambahkan SATU baris JSON ke `e2e-stats.jsonl` (proyek,
 * gitignored; di CI di-upload sebagai artifact `e2e-stats`). Baris memuat
 * jumlah request & non-2xx (regex & aritmetika SAMA dengan ringkasan artifact
 * writeSuccessSummary) plus daftar entri non-2xx dengan atribusi spec
 * (via laporan mutasi fixture e2e/mutation-log.ts) — jadi kenaikan non-2xx
 * bisa dilacak ke SPEC yang menyebabkannya.
 */
import { readFileSync } from "node:fs";

export interface Non2xxEntry {
  method: string;
  path: string;
  status: number;
  /** Spec (dari pragma mutation-log) yang meminta path ini — null bila tak teratribusi. */
  spec?: string | null;
}

export interface RunStatsEntry {
  runId: number | null;
  workflow: string | null;
  branch: string | null;
  timestamp: string;
  requests: {
    total: number;
    non2xx: number;
    byMethod: Record<string, number>;
  };
  non2xx: Non2xxEntry[];
}

/** Baris request server: `GET /api/x 200 in 138ms` / `DELETE /api/x 200 in 5.3s`. */
const REQ_RE =
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) (\S+) (\d{3}) in [\d.]+(?:ms|s)/;

/** Hitung statistik request dari baris log server (sama dengan ringkasan artifact). */
export function computeRequestStats(lines: readonly string[]): {
  total: number;
  non2xx: number;
  byMethod: Record<string, number>;
  entries: Array<{ method: string; path: string; status: number }>;
} {
  const byMethod: Record<string, number> = {};
  const entries: Array<{ method: string; path: string; status: number }> = [];
  let total = 0;
  let non2xx = 0;
  for (const line of lines) {
    const m = REQ_RE.exec(line.trim());
    if (!m) continue;
    total += 1;
    byMethod[m[1]] = (byMethod[m[1]] ?? 0) + 1;
    const status = Number(m[3]);
    if (!String(status).startsWith("2")) {
      non2xx += 1;
      entries.push({ method: m[1], path: m[2], status });
    }
  }
  return { total, non2xx, byMethod, entries };
}

/**
 * Peta path → set specFile dari laporan mutasi (JSONL `{specFile, path}`).
 * Hanya mutasi yang tercatat di fixture — GET non-mutasi tak teratribusi.
 */
export function buildSpecByPath(reportText: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const line of reportText.split("\n").filter((l) => l.trim())) {
    try {
      const entry = JSON.parse(line) as { specFile: string; path: string };
      const set = out.get(entry.path) ?? new Set<string>();
      set.add(entry.specFile);
      out.set(entry.path, set);
    } catch {
      // baris rusak — abaikan.
    }
  }
  return out;
}

/** Bangun entri stats satu run dari log server + laporan mutasi. */
export function buildRunStats(opts: {
  serverLogText: string;
  reportText: string;
  runId: number | null;
  workflow: string | null;
  branch: string | null;
  timestamp?: string;
}): RunStatsEntry {
  const { total, non2xx, byMethod, entries } = computeRequestStats(
    opts.serverLogText.split("\n")
  );
  const specByPath = buildSpecByPath(opts.reportText);
  const tagged: Non2xxEntry[] = entries.map((e) => {
    const specs = specByPath.get(e.path);
    return {
      ...e,
      spec: specs && specs.size ? [...specs].sort().join(",") : null,
    };
  });
  return {
    runId: opts.runId,
    workflow: opts.workflow,
    branch: opts.branch,
    timestamp: opts.timestamp ?? new Date().toISOString(),
    requests: { total, non2xx, byMethod },
    non2xx: tagged,
  };
}

export function parseStatsLine(line: string): RunStatsEntry | null {
  try {
    return JSON.parse(line) as RunStatsEntry;
  } catch {
    return null;
  }
}

/** Baris JSON terakhir dari file jsonl (atau null bila tak terbaca/kosong). */
export function lastLineOf(path: string): string | null {
  try {
    const lines = readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.trim());
    return lines.length ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

/** Kunci identitas entri non-2xx: `METHOD path status`. */
export function entryKey(e: { method: string; path: string; status: number }): string {
  return `${e.method} ${e.path} ${e.status}`;
}
