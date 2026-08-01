import { test, expect, type Page } from "@playwright/test";

const ADMIN = {
  email: "admin@mongisidi1.sch.id",
  password: "admin123",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("News CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate to news management via the sidebar", async ({ page }) => {
    // Sidebar item is a <button> (not a link).
    await page.getByRole("button", { name: "Berita & Artikel" }).click();
    // level:2 → module heading (topbar also shows the same label as an <h1>).
    await expect(
      page.getByRole("heading", { name: "Berita & Artikel", level: 2 })
    ).toBeVisible();
    // Hash sub-route is set and the store route switched (URL reflects it).
    await expect(page).toHaveURL(/#\/dashboard\/news/);
  });

  test("should create, read, edit and delete a news item", async ({ page }) => {
    // Open the news manager through the sidebar.
    await page.getByRole("button", { name: "Berita & Artikel" }).click();
    await expect(
      page.getByRole("heading", { name: "Berita & Artikel", level: 2 })
    ).toBeVisible();

    const title = uniqueTitle("E2E Berita");

    // --- CREATE ---
    await page.getByRole("button", { name: "Tambah Berita" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tambah Berita" })
    ).toBeVisible();

    // exact:true → avoids the rich-text toolbar buttons "Judul H2"/"Sub Judul H3".
    await page.getByLabel("Judul", { exact: true }).fill(title);
    await page.getByLabel("Ringkasan", { exact: true }).fill("Ringkasan dari test E2E.");
    // contentEditable editor (role=textbox, aria-label="Konten berita").
    await page
      .getByRole("textbox", { name: "Konten berita" })
      .fill("<p>Konten paragraf untuk test E2E.</p>");
    await page.getByRole("button", { name: "Simpan" }).click();

    // Toast + the item appears in the list (search to be deterministic).
    await expect(page.getByText("Berita dibuat.")).toBeVisible();
    const createSearchDone = page.waitForResponse(
      (r) => r.url().includes("/api/news") && r.url().includes("search="),
      { timeout: 15000 }
    );
    await page.getByPlaceholder("Cari judul berita…").fill(title);
    // exact:true → the checkbox cell "Pilih <title>" also contains the title.
    await expect(page.getByRole("cell", { name: title, exact: true })).toBeVisible();
    await createSearchDone;

    // --- READ (detail row visible) ---
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Draft");

    // --- UPDATE ---
    const editedTitle = `${title} (diubah)`;
    await row.getByRole("button", { name: "Edit berita" }).click();
    await page.getByLabel("Judul", { exact: true }).fill(editedTitle);
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("Berita diperbarui.")).toBeVisible();
    // The edited cell may already be visible from the pre-refetch list, so wait
    // for the debounced search request to finish — otherwise the list reloads
    // (loading → PageLoader) mid-interaction and closes the dialog. The
    // predicate is scoped to the exact search term so the save-triggered
    // fetchList (which still uses the previous `search=title`) can't satisfy it.
    const searchDone = page.waitForResponse(
      (r) => {
        const u = new URL(r.url());
        return (
          u.pathname.includes("/api/news") &&
          u.searchParams.get("search") === editedTitle
        );
      },
      { timeout: 15000 }
    );
    await page.getByPlaceholder("Cari judul berita…").fill(editedTitle);
    await expect(
      page.getByRole("cell", { name: editedTitle, exact: true })
    ).toBeVisible();
    await searchDone;

    // --- DELETE ---
    const editedRow = page.getByRole("row").filter({ hasText: editedTitle });
    await editedRow.getByRole("button", { name: "Hapus berita" }).click();
    // Scope to the alert dialog and wait for it to be fully rendered before
    // confirming (avoids clicking mid-animation / remount flakiness).
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole("button", { name: "Hapus", exact: true })
      .click();

    await expect(page.getByText("Berita dihapus.")).toBeVisible();
    // The title no longer appears in the list.
    await page.getByPlaceholder("Cari judul berita…").fill(editedTitle);
    await expect(
      page.getByRole("cell", { name: editedTitle, exact: true })
    ).toHaveCount(0);
  });
});
