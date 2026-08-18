import { test, expect } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/news /api/csrf-token /api/auth/login

// Known-benign dev-mode noise — anything else is treated as a real error.
const BENIGN_CONSOLE = [
  "Download the React DevTools",
  "favicon.ico",
  "Failed to load resource: the server responded with a status of 404",
];

test.describe("CSRF Header Verification", () => {
  test("POST /api/news must carry the x-csrf-token header (network-level check)", async ({
    page,
  }) => {
    // Capture console errors so the browser tab state can be verified too.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await login(page, ADMIN.email, ADMIN.password);

    // Read the double-submit cookie value BEFORE saving so we can prove the
    // header the interceptor sent equals the token the server issued.
    const cookieToken = await page.evaluate(() => {
      const m = document.cookie.match(/(?:^|; )monsa_csrf=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : null;
    });

    // Capture every POST to /api/news with its request headers + response status.
    const csrfHeaders: string[] = [];
    const responseStatuses: number[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/news")) {
        csrfHeaders.push(req.headers()["x-csrf-token"] ?? "");
      }
    });
    page.on("response", (res) => {
      if (
        res.request().method() === "POST" &&
        res.url().includes("/api/news")
      ) {
        responseStatuses.push(res.status());
      }
    });

    // Sidebar → news manager.
    await page.getByRole("button", { name: "Berita & Artikel" }).click();
    await expect(
      page.getByRole("heading", { name: "Berita & Artikel", level: 2 })
    ).toBeVisible();

    const title = `E2E CSRF Header ${Date.now()}`;

    // Create the news item — the POST fires on Save.
    await page.getByRole("button", { name: "Tambah Berita" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tambah Berita" })
    ).toBeVisible();
    await page.getByLabel("Judul", { exact: true }).fill(title);
    await page.getByLabel("Ringkasan", { exact: true }).fill(
      "Ringkasan verifikasi header CSRF di browser."
    );
    await page
      .getByRole("textbox", { name: "Konten berita" })
      .fill("<p>Konten verifikasi CSRF.</p>");
    await page.getByRole("button", { name: "Simpan" }).click();

    // The save must succeed (would be 403 if the token were missing).
    await expect(page.getByText("Berita dibuat.")).toBeVisible();

    // Search for the item so the list is deterministic (same pattern as
    // news-crud.spec.ts), waiting for the debounced refetch to finish.
    const searchDone = page.waitForResponse(
      (r) => {
        const u = new URL(r.url());
        return (
          u.pathname.includes("/api/news") &&
          u.searchParams.get("search") === title
        );
      },
      { timeout: 15000 }
    );
    await page.getByPlaceholder("Cari judul berita…").fill(title);
    await expect(
      page.getByRole("cell", { name: title, exact: true })
    ).toBeVisible();
    await searchDone;

    // NETWORK-LEVEL ASSERTIONS — the whole point of this spec.
    expect(
      csrfHeaders.length,
      "at least one POST /api/news request must have been captured"
    ).toBeGreaterThan(0);
    for (const h of csrfHeaders) {
      expect(h, "x-csrf-token header must be present and non-empty").not.toBe("");
    }
    // The login POST already triggered the interceptor → GET /api/csrf-token
    // → server Set-Cookie monsa_csrf. So the cookie must exist by now, and
    // the header the interceptor sent must equal the server-issued token.
    expect(cookieToken, "monsa_csrf cookie must exist after login").not.toBeNull();
    expect(
      csrfHeaders[0],
      "header value must match the monsa_csrf cookie issued by the server"
    ).toBe(cookieToken);
    for (const s of responseStatuses) {
      expect(s, "create must not be rejected (403) by CSRF middleware")
        .toBeGreaterThanOrEqual(200);
      expect(s).toBeLessThan(300);
    }

    // Cleanup: delete the created item (search term still applied).
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("button", { name: "Hapus berita" }).click();
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();
    // Toast baru muncul SETELAH respons DELETE diterima. Di dev server yang
    // dingin, hit pertama ke route handler bisa nge-stall >5s saat Turbopack
    // mengompilasi modulnya (contoh nyata: DELETE /api/news/[id] pertama 5.3s,
    // lalu 108ms setelah ter-compile) — toast muncul setelah timeout asersi
    // default 5s habis → flaky. playwright.config.ts menaikkan timeout asersi
    // global ke 15s (expect: { timeout: 15_000 }); jangan turunkan, dan jangan
    // menimpa per-asersi dengan timeout pendek di spec ini.
    await expect(page.getByText("Berita dihapus.")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: title, exact: true })
    ).toHaveCount(0);

    // The verification tab should be free of real console errors.
    const realErrors = consoleErrors.filter(
      (e) => !BENIGN_CONSOLE.some((b) => e.includes(b))
    );
    expect(realErrors, `console errors: ${realErrors.join(" | ")}`).toEqual([]);
  });
});
