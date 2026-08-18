/**
 * Fixture mutasi e2e — SATU sumber kebenaran atribusi request → spec.
 *
 * Mencatat SEMUA request API (GET + mutasi) ke laporan JSONL
 * `E2E_MUTATION_REPORT` (default %TEMP%/monsa-e2e-mutations.jsonl):
 *   { specFile, method, path, query }
 *
 * Dua jalur perekaman:
 *   1. `page` fixture — request yang lahir dari browser (page.on("request")).
 *   2. `request` fixture — panggilan via Playwright APIRequestContext
 *      (request.get / context.request.*), dibungkus Proxy agar setiap
 *      method ter-capture. APIRequestContext versi ini TIDAK meng-emit
 *      event, jadi listener page.on("request") tidak menangkapnya —
 *      override Proxy adalah satu-satunya cara untuk mencatatnya.
 *
 * Konsumen:
 *   - scripts/run-e2e.ts    — ringkasan warm-up per spec (declared vs exercised)
 *   - scripts/check-warmup-declarations.ts — CI check: mutasi wajib ter-deklarasi
 *   - scripts/e2e-stats.ts  — atribusi non-2xx ke spec
 */
import { test as base, expect } from "@playwright/test";
import { appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export { expect };
export type { APIRequest } from "@playwright/test";

/** Path laporan JSONL — override via E2E_MUTATION_REPORT (default %TEMP%). */
export const E2E_MUTATION_REPORT =
  process.env.E2E_MUTATION_REPORT ?? join(tmpdir(), "monsa-e2e-mutations.jsonl");

/** Method APIRequestContext yang dibungkus Proxy agar tercatat. */
const API_METHODS = new Set([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
  "fetch",
]);

/** Tulis satu baris JSONL (sinkron; kegagalan sink diam — fixture tetap jalan). */
function record(specFile: string, method: string, url: string, query: string): void {
  try {
    const path = url.split("?")[0];
    appendFileSync(
      E2E_MUTATION_REPORT,
      JSON.stringify({ specFile, method, path, query }) + "\n"
    );
  } catch {
    // sink gagal — laporan hilang, suite tetap berjalan.
  }
}

// File ini tidak mengandung React — `use` adalah parameter fixture Playwright,
// bukan React Hook. Nonaktifkan rule untuk seluruh file.
/* eslint-disable react-hooks/rules-of-hooks */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const specFile = testInfo.file.split(/[\\/]/).pop() ?? "unknown";
    page.on("request", (req) => {
      const url = req.url();
      if (!url.includes("/api/")) return;
      try {
        const u = new URL(url);
        record(specFile, req.method(), u.pathname, u.search);
      } catch {
        // URL tak valid — lewati.
      }
    });
    await use(page);
  },

  request: async ({ request }, use, testInfo) => {
      const specFile = testInfo.file.split(/[\\/]/).pop() ?? "unknown";
      const wrapped = new Proxy(request, {
        get(target, prop, receiver) {
          if (typeof prop === "string" && API_METHODS.has(prop)) {
            return (...args: unknown[]) => {
              const [urlOrReq] = args;
              const url =
                typeof urlOrReq === "string"
                  ? urlOrReq
                  : urlOrReq && typeof urlOrReq === "object" && "url" in urlOrReq
                    ? String((urlOrReq as { url: () => string }).url())
                    : String(urlOrReq);
              const options = args[1] as { method?: string } | undefined;
              const method =
                prop === "fetch" && options?.method
                  ? options.method.toUpperCase()
                  : String(prop).toUpperCase();
              let query = "";
              try {
                query = new URL(url).search;
              } catch {
                const q = url.indexOf("?");
                query = q >= 0 ? url.slice(q) : "";
              }
              record(specFile, method, url, query);
              return (target[prop] as (...a: unknown[]) => unknown)(...args);
            };
          }
          const v = Reflect.get(target, prop, receiver);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    await use(wrapped);
  },
});
