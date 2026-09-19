import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";
import type { Page } from "@playwright/test";

// warmup: /api/dapodik/config /api/dapodik/test-connection /api/auth/login

/**
 * Uji end-to-end koneksi Dapodik lewat Cloudflare Access (service token).
 *
 * Tidak ada tunnel Cloudflare nyata di lingkungan e2e, jadi "upstream ber-
 * Cloudflare Access" diemulasi: server HTTP lokal yang meniru perilakunya —
 * 403 bila CF-Access-Client-Id/Secret tidak cocok, 401 bila Bearer token
 * Web Service salah, dan 200 + payload getSekolah bila kedua lapisan lolos.
 *
 * Yang dibuktikan jalan benar-benar (bukan hanya unit test):
 *   1. Simpan kredensial via form → tersimpan terenkripsi di DB.
 *   2. POST /api/dapodik/test-connection membangkitkan DapodikClient dari
 *      DB, mendekripsi token + secret, dan mengirimnya sebagai header.
 *   3. Happy path → "Koneksi berhasil" + nama sekolah dari upstream.
 *   4. Secret CF salah → 403 diteruskan sebagai kegagalan koneksi.
 *   5. Bearer token salah → 401 diteruskan (4xx tidak di-retry).
 *
 * Config singleton dipotret sekali lalu dipulihkan di afterEach; emulator
 * listen di port acak (0) per test sehingga tidak ada bentrok port.
 */

const CF_ID = "e2e-cf.access.example";
const CF_SECRET = "e2e-cf-secret-123";
const WS_TOKEN = "e2e-ws-token-456";

type Upstream = {
  port: number;
  close: () => Promise<void>;
};

async function startCfAccessUpstream(opts: {
  clientId: string;
  clientSecret: string;
  wsToken: string;
  /** Bila true, upstream membalas { rows: [] } — ala Dapodik untuk NPSN tak dikenal. */
  emptyRows?: boolean;
}): Promise<Upstream> {
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    const cid = req.headers["cf-access-client-id"];
    const csec = req.headers["cf-access-client-secret"];
    const auth = req.headers["authorization"];

    if (cid !== opts.clientId || csec !== opts.clientSecret) {
      res.writeHead(403, { "content-type": "text/html" });
      res.end("<html><body>Access denied</body></html>");
      return;
    }
    if (auth !== `Bearer ${opts.wsToken}`) {
      res.writeHead(401, { "content-type": "text/html" });
      res.end("<html><body>Access denied</body></html>");
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    if (opts.emptyRows) {
      // Dapodik membalas 200 + rows kosong untuk NPSN yang tidak terdaftar —
      // bukan 401/403. Sambut dengan JSON valid agar sampai ke requestSingle.
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ rows: [] }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        rows: [
          {
            nama: "SDN E2E Via CF Access",
            npsn: url.searchParams.get("npsn") ?? "",
            alamat_jalan: "Jl. Emulator 123",
          },
        ],
      })
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { port, close: () => new Promise((r) => server.close(() => r())) };
}

async function openConfig(page: Page) {
  // Tunggu GET config (useEffect mount) selesai — hindari race UI state
  // dengan interaksi berikutnya (fill/switch).
  const configRes = page.waitForResponse(
    (r) => r.url().includes("/api/dapodik/config") && r.request().method() === "GET"
  );
  await page.goto("/dashboard/dapodik");
  await configRes;
  await page.getByRole("button", { name: "Konfigurasi", exact: true }).click();
  await expect(page.getByLabel("NPSN")).toBeVisible();
}

async function saveCredentials(page: Page, port: number) {
  await page.getByLabel("NPSN").fill("40313912");
  await page.getByLabel("Token").fill(WS_TOKEN);
  await page.getByLabel("Host").fill("127.0.0.1");
  await page.getByLabel("Port").fill(String(port));
  await page.getByLabel("CF Access Client ID").fill(CF_ID);
  await page.getByLabel("CF Access Client Secret").fill(CF_SECRET);
  // Workflow E2E prod-mode menjalankan server dengan NODE_ENV=production;
  // emulator upstream-nya HTTP murni. Tanpa ini DapodikClient menolak
  // membangun koneksi ("HTTP tidak diizinkan di production") SEBELUM
  // menyentuh upstream — happy path gagal dan test negatif jadi false-pass.
  // Toggle idempoten: state awal bergantung isi DB, bukan asumsi.
  const insecureSwitch = page.getByRole("switch", { name: "Izinkan HTTP di production" });
  if ((await insecureSwitch.getAttribute("aria-checked")) !== "true") {
    await insecureSwitch.click();
    await expect(insecureSwitch).toHaveAttribute("aria-checked", "true");
  }
  // Server e2e berjalan mode production (next start) — guard DapodikClient
  // menolak HTTP sebelum request keluar bila toggle ini mati, sehingga semua
  // test "gagal" akan lulus palsu dan test sukses tak pernah menyentuh upstream.
  await page.getByRole("button", { name: "Simpan Konfigurasi" }).click();
  await expect(page.getByText("Konfigurasi tersimpan!")).toBeVisible();
  // Simpan menutup panel konfigurasi — buka lagi untuk menjangkau
  // tombol "Cek Koneksi" yang ada di dalam panel.
  await page.getByRole("button", { name: "Konfigurasi", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cek Koneksi" })).toBeVisible();
}

/**
 * POST /api/dapodik/config dengan CSRF yang valid — POST API tanpa header
 * x-csrf-token selalu 403 secara diam (requireCsrf), yang dulu membuat
 * restore afterEach tidak pernah jalan. Gagal restore meledak keras.
 */
async function postConfig(page: Page, data: Record<string, unknown>) {
  const tokenRes = await page.request.get("/api/csrf-token");
  expect(tokenRes.ok()).toBeTruthy();
  const { token } = (await tokenRes.json()) as { token: string };
  const res = await page.request.post("/api/dapodik/config", {
    data,
    headers: { "x-csrf-token": token },
  });
  expect(res.ok()).toBeTruthy();
  return res;
}

test.describe("Dapodik koneksi via Cloudflare Access (emulasi upstream)", () => {
  let snapshot: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    if (snapshot === null) {
      const res = await page.request.get("/api/dapodik/config");
      if (res.ok()) {
        const json = await res.json();
        snapshot = (json.config as Record<string, unknown> | null) ?? null;
      }
    }
  });

  test.afterEach(async ({ page }) => {
    if (!snapshot) return;
    await postConfig(page, {
      npsn: String(snapshot.npsn ?? ""),
      host: String(snapshot.host ?? "localhost"),
      port: Number(snapshot.port ?? 5774),
      protocol: String(snapshot.protocol ?? "http"),
      cfAccessClientId: snapshot.cfAccessClientId
        ? String(snapshot.cfAccessClientId)
        : "",
      // Boolean TIDAK dipertahankan bila absen (route memakai default) —
      // kirim eksplisit dari snapshot.
      archiveUnlisted: snapshot.archiveUnlisted !== false,
      allowInsecureInProduction: snapshot.allowInsecureInProduction === true,
      // token & cfAccessClientSecret tidak dikirim → dipertahankan.
    });
  });

  test("simpan kredensial CF Access → test-connection lolos kedua lapisan", async ({ page }) => {
    const upstream = await startCfAccessUpstream({
      clientId: CF_ID,
      clientSecret: CF_SECRET,
      wsToken: WS_TOKEN,
    });

    await openConfig(page);
    await saveCredentials(page, upstream.port);
    await page.getByRole("button", { name: "Cek Koneksi" }).click();

    await expect(page.getByText(/Koneksi berhasil/)).toBeVisible({ timeout: 20_000 });
    // Nama sekolah dari payload upstream — bukti respons utuh sampai UI.
    await expect(page.getByText(/SDN E2E Via CF Access/)).toBeVisible({ timeout: 20_000 });
    await upstream.close();
  });

  test("secret CF salah di upstream → test-connection gagal (403 diteruskan)", async ({ page }) => {
    const upstream = await startCfAccessUpstream({
      clientId: CF_ID,
      clientSecret: "secret-lain-999",
      wsToken: WS_TOKEN,
    });

    await openConfig(page);
    await saveCredentials(page, upstream.port);
    await page.getByRole("button", { name: "Cek Koneksi" }).click();

    await expect(page.getByText(/Koneksi gagal/)).toBeVisible({ timeout: 20_000 });
    await upstream.close();
  });

  test("Bearer token salah → gagal fail-fast (401 tidak di-retry)", async ({ page }) => {
    const upstream = await startCfAccessUpstream({
      clientId: CF_ID,
      clientSecret: CF_SECRET,
      wsToken: "token-lain-888",
    });

    await openConfig(page);
    await saveCredentials(page, upstream.port);
    await page.getByRole("button", { name: "Cek Koneksi" }).click();

    await expect(page.getByText(/Koneksi gagal/)).toBeVisible({ timeout: 20_000 });
    await upstream.close();
  });

  test("service token valid tapi NPSN salah → gagal dengan pesan yang jelas", async ({ page }) => {
    // Kedua lapisan upstream (CF Access + Bearer) menerima — kegagalan murni
    // dari NPSN yang tidak dikenal server Dapodik (rows kosong, HTTP 200).
    const upstream = await startCfAccessUpstream({
      clientId: CF_ID,
      clientSecret: CF_SECRET,
      wsToken: WS_TOKEN,
      emptyRows: true,
    });

    await openConfig(page);
    await saveCredentials(page, upstream.port);
    await page.getByRole("button", { name: "Cek Koneksi" }).click();

    await expect(page.getByText(/Koneksi gagal/)).toBeVisible({ timeout: 20_000 });
    // Pesan menyebut NPSN — hasil perbaikan requestSingle, bukan
    // "nama undefined" yang samar dari getSekolah mengembalikan undefined.
    // .first(): pesan sama muncul di toast sonner DAN kartu error.
    await expect(page.getByText(/NPSN tidak terdaftar/).first()).toBeVisible({ timeout: 20_000 });
    await upstream.close();
  });
});
