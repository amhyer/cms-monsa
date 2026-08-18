/**
 * Cek tren non-2xx ANTAR RUN e2e — alert saat spec baru menaikkan non-2xx
 * secara diam-diam (suite tetap hijau, tapi jumlah 4xx/5xx merayap naik).
 *
 * Sumber baseline (urutan prioritas):
 *   1. E2E_PREV_STATS — path ke `e2e-stats.jsonl` run sebelumnya (di CI:
 *      artifact `e2e-stats` yang diunduh step download-artifact dengan
 *      run-id run sebelumnya).
 *   2. Baris kedua-terakhir `E2E_STATS_FILE` (riwayat lokal — `test:e2e`
 *      menambahkan satu baris per run).
 *
 * Alert bila (vs baseline): delta non-2xx >= E2E_NON2XX_ALERT_DELTA (default
 * 5) ATAU ada entri non-2xx BARU (method+path+status yang belum pernah ada) —
 * entri baru biasanya berasal dari spec baru (dengan tag spec dari laporan
 * mutasi). Ditulis ke konsol + $GITHUB_STEP_SUMMARY sebagai section ⚠️.
 * Exit 0 (warning) kecuali E2E_NON2XX_FAIL=true → exit 1 (gate ketat).
 */
import { appendFileSync, readFileSync } from "node:fs";
import {
  entryKey,
  lastLineOf,
  parseStatsLine,
  type RunStatsEntry,
} from "./e2e-stats";

const STATS_FILE = process.env.E2E_STATS_FILE ?? "e2e-stats.jsonl";
const PREV_STATS = process.env.E2E_PREV_STATS ?? "";
const ALERT_DELTA = Number(process.env.E2E_NON2XX_ALERT_DELTA ?? 5);
const FAIL = process.env.E2E_NON2XX_FAIL === "true";

const emit = (m: string) => console.log(m);

function readLocalBaseline(): RunStatsEntry | null {
  try {
    const lines = readFileSync(STATS_FILE, "utf8")
      .split("\n")
      .filter((l) => l.trim());
    return lines.length >= 2 ? parseStatsLine(lines[lines.length - 2]) : null;
  } catch {
    return null;
  }
}

function main(): number {
  const curLine = lastLineOf(STATS_FILE);
  if (!curLine) {
    emit(`[e2e:non2xx] tidak ada statistik run (${STATS_FILE}) — lewati.`);
    return 0;
  }
  const current = parseStatsLine(curLine);
  if (!current) {
    emit(`[e2e:non2xx] baris statistik rusak di ${STATS_FILE} — lewati.`);
    return 0;
  }

  let prev: RunStatsEntry | null = null;
  if (PREV_STATS) {
    const l = lastLineOf(PREV_STATS);
    prev = l ? parseStatsLine(l) : null;
    if (!l) {
      emit(
        `[e2e:non2xx] baseline ${PREV_STATS} tidak terbaca — jadikan run ini baseline.`
      );
    }
  } else {
    prev = readLocalBaseline();
  }

  const label = current.runId
    ? `run #${current.runId}${current.branch ? ` (${current.branch})` : ""}`
    : "run lokal";
  const cur = current.requests.non2xx;
  const total = current.requests.total;

  if (!prev) {
    emit(
      `[e2e:non2xx] ${label}: non-2xx ${cur}/${total} — BASELINE (belum ada run sebelumnya untuk dibandingkan).`
    );
    return 0;
  }

  const delta = cur - prev.requests.non2xx;
  const prevKeys = new Set(prev.non2xx.map(entryKey));
  const newEntries = current.non2xx.filter((e) => !prevKeys.has(entryKey(e)));
  const newSpecs = [
    ...new Set(newEntries.map((e) => e.spec).filter((s): s is string => Boolean(s))),
  ];

  emit(
    `[e2e:non2xx] ${label}: non-2xx ${prev.requests.non2xx} → ${cur} ` +
      `(delta ${delta >= 0 ? "+" : ""}${delta}) · ${total} request` +
      (newEntries.length ? ` · ${newEntries.length} entri baru` : "")
  );

  const alert = delta >= ALERT_DELTA || newEntries.length > 0;
  if (!alert) {
    emit("[e2e:non2xx] tidak ada kenaikan mencurigakan — aman.");
    return 0;
  }

  const lines = [
    "## ⚠️ Non-2xx naik",
    "",
    `- Non-2xx: **${prev.requests.non2xx} → ${cur}** (delta ${delta >= 0 ? "+" : ""}${delta}) — ` +
      (delta >= ALERT_DELTA
        ? `di atas ambang ${ALERT_DELTA}`
        : "ada entri non-2xx baru") +
      ` (baseline: run ${prev.runId ?? "?"}).`,
    ...(newSpecs.length
      ? [`- Spec dengan entri baru: **${newSpecs.join(", ")}**`]
      : []),
    "- Entri non-2xx baru (maks 10):",
    ...newEntries
      .slice(0, 10)
      .map((e) => `  - ${e.method} ${e.path} ${e.status}${e.spec ? ` (${e.spec})` : ""}`),
    ...(newEntries.length > 10
      ? [`  - … +${newEntries.length - 10} lainnya`]
      : []),
  ];
  const text = lines.join("\n");
  emit(`\n${text}`);

  const sp = process.env.GITHUB_STEP_SUMMARY;
  if (sp) {
    try {
      appendFileSync(sp, `${text}\n\n`);
      emit("[e2e:non2xx] alert ditambahkan ke step summary.");
    } catch (e) {
      emit(`[e2e:non2xx] gagal menulis step summary: ${String(e)}`);
    }
  }

  if (FAIL) {
    emit(
      "::error::Non-2xx naik melewati ambang — periksa entri baru di atas (regresi diam-diam)."
    );
    return 1;
  }
  return 0;
}

process.exit(main());
