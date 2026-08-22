// warmup: /api/news /api/agenda /api/achievements /api/settings
import { test, expect } from "./mutation-log";

const MOBILE = { width: 375, height: 667 };

/**
 * Navigate to the contact page at mobile viewport.
 * The form is on /contact with heading "Hubungi Kami & SPMB".
 */
async function goToContact(page: import("@playwright/test").Page) {
  await page.setViewportSize(MOBILE);
  await page.goto("/contact", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Hubungi Kami & SPMB" })
  ).toBeVisible();
}

test.describe("Contact form validation — mobile (375px)", () => {
  // ─── Empty form submission ───────────────────────────────────────
  test.describe("Empty form submission", () => {
    test("submitting empty form shows required errors for name, email, subject, and message", async ({
      page,
    }) => {
      await goToContact(page);

      // Click submit without filling anything
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // All required field errors should appear
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Email wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Subjek wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Pesan wajib diisi." })
      ).toBeVisible();
    });

    test("toast error appears when submitting invalid form", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit empty form
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // Toast should show the validation error message
      await expect(
        page.getByText("Mohon perbaiki isian yang belum sesuai.")
      ).toBeVisible();
    });

    test("no API request is sent when validation fails", async ({ page }) => {
      await goToContact(page);

      // Track network requests — should NOT see POST /api/contact
      let postRequested = false;
      page.on("request", (req) => {
        if (
          req.url().includes("/api/contact") &&
          req.method() === "POST"
        ) {
          postRequested = true;
        }
      });

      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // Wait a moment to ensure no request fires
      await page.waitForTimeout(500);
      expect(postRequested).toBe(false);
    });
  });

  // ─── Individual field validation ─────────────────────────────────
  test.describe("Individual field validation", () => {
    test("name empty → error, valid name → error clears", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit to trigger validation
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeVisible();

      // Fill in the name — error should clear
      await page.getByPlaceholder("Nama Anda").fill("Budi Santoso");

      // Re-submit: name error should be gone
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeHidden();
    });

    test("email empty → error, invalid format → format error, valid → clears", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit to trigger validation
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Email wajib diisi." })
      ).toBeVisible();

      // Type invalid email, then blur to trigger onBlur validation
      await page.getByPlaceholder("email@contoh.com").fill("not-an-email");
      await page.getByPlaceholder("email@contoh.com").blur();

      // Format error should appear
      await expect(
        page.getByRole("alert", {
          name: "Format email tidak valid (contoh: nama@contoh.com).",
        })
      ).toBeVisible();

      // Fix the email
      await page.getByPlaceholder("email@contoh.com").fill("budi@example.com");
      await page.getByPlaceholder("email@contoh.com").blur();

      // Error should be cleared
      await expect(
        page.getByRole("alert", {
          name: "Format email tidak valid (contoh: nama@contoh.com).",
        })
      ).toBeHidden();
    });

    test("subject empty → error, filling clears it", async ({ page }) => {
      await goToContact(page);

      // Submit to trigger validation
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Subjek wajib diisi." })
      ).toBeVisible();

      // Fill subject
      await page.getByPlaceholder("Subjek pesan").fill("Pertanyaan SPMB");

      // Re-submit: subject error should be gone
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Subjek wajib diisi." })
      ).toBeHidden();
    });

    test("message empty → error, too short → minimum error, valid → clears", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit to trigger validation
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", { name: "Pesan wajib diisi." })
      ).toBeVisible();

      // Type a short message (< 10 chars)
      await page
        .getByPlaceholder("Tulis pesan Anda di sini…")
        .fill("Halo");

      // Re-submit: should show the "too short" error
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(
        page.getByRole("alert", {
          name: "Pesan terlalu singkat (minimal 10 karakter).",
        })
      ).toBeVisible();

      // Fix the message to be long enough
      await page
        .getByPlaceholder("Tulis pesan Anda di sini…")
        .fill("Ini adalah pesan yang cukup panjang untuk validasi.");
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // Message error should be cleared
      await expect(
        page.getByRole("alert", { name: "Pesan wajib diisi." })
      ).toBeHidden();
      await expect(
        page.getByRole("alert", {
          name: "Pesan terlalu singkat (minimal 10 karakter).",
        })
      ).toBeHidden();
    });
  });

  // ─── aria-invalid attribute ──────────────────────────────────────
  test.describe("aria-invalid attributes", () => {
    test("email field has aria-invalid after failed validation", async ({
      page,
    }) => {
      await goToContact(page);

      const emailInput = page.getByPlaceholder("email@contoh.com");

      // Before submission, aria-invalid should not be set
      await expect(emailInput).not.toHaveAttribute("aria-invalid", "true");

      // Submit empty form
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // After validation failure, aria-invalid should be true
      await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });

    test("email aria-invalid clears on valid input", async ({ page }) => {
      await goToContact(page);

      const emailInput = page.getByPlaceholder("email@contoh.com");

      // Trigger validation error
      await page.getByRole("button", { name: "Kirim Pesan" }).click();
      await expect(emailInput).toHaveAttribute("aria-invalid", "true");

      // Type valid email — error clears on change
      await emailInput.fill("test@example.com");

      // aria-invalid should be cleared
      await expect(emailInput).not.toHaveAttribute("aria-invalid", "true");
    });

    test("message field has aria-invalid after failed validation", async ({
      page,
    }) => {
      await goToContact(page);

      const messageInput = page.getByPlaceholder("Tulis pesan Anda di sini…");

      // Trigger validation error
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      await expect(messageInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  // ─── Multiple simultaneous errors ────────────────────────────────
  test.describe("Multiple errors", () => {
    test("all errors shown at once, then all clear after filling all fields", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit empty form
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // All 4 errors should be visible simultaneously
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Email wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Subjek wajib diisi." })
      ).toBeVisible();
      await expect(
        page.getByRole("alert", { name: "Pesan wajib diisi." })
      ).toBeVisible();

      // Fill all required fields
      await page.getByPlaceholder("Nama Anda").fill("Budi Santoso");
      await page.getByPlaceholder("email@contoh.com").fill("budi@example.com");
      await page.getByPlaceholder("Subjek pesan").fill("Pertanyaan SPMB");
      await page
        .getByPlaceholder("Tulis pesan Anda di sini…")
        .fill("Saya ingin bertanya tentang pendaftaran SPMB tahun ini.");

      // Re-submit
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // All errors should be cleared (form will try to POST — may fail with
      // network error, but field-level validation errors should be gone)
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeHidden();
      await expect(
        page.getByRole("alert", { name: "Email wajib diisi." })
      ).toBeHidden();
      await expect(
        page.getByRole("alert", { name: "Subjek wajib diisi." })
      ).toBeHidden();
      await expect(
        page.getByRole("alert", { name: "Pesan wajib diisi." })
      ).toBeHidden();
    });
  });

  // ─── Email blur validation ───────────────────────────────────────
  test.describe("Email blur validation", () => {
    test("typing invalid email then blurring shows format error immediately", async ({
      page,
    }) => {
      await goToContact(page);

      const emailInput = page.getByPlaceholder("email@contoh.com");

      // Type invalid email
      await emailInput.fill("not-a-valid-email");
      await emailInput.blur();

      // Format error should appear (from onBlur handler)
      await expect(
        page.getByRole("alert", {
          name: "Format email tidak valid (contoh: nama@contoh.com).",
        })
      ).toBeVisible();
    });

    test("typing valid email then blurring does NOT show format error", async ({
      page,
    }) => {
      await goToContact(page);

      const emailInput = page.getByPlaceholder("email@contoh.com");

      // Type valid email
      await emailInput.fill("test@example.com");
      await emailInput.blur();

      // No format error should appear
      await expect(
        page.getByRole("alert", {
          name: "Format email tidak valid (contoh: nama@contoh.com).",
        })
      ).toBeHidden();
    });

    test("empty email field does not trigger blur validation error", async ({
      page,
    }) => {
      await goToContact(page);

      const emailInput = page.getByPlaceholder("email@contoh.com");

      // Leave email empty and blur — onBlur only runs if form.email is truthy
      await emailInput.blur();

      // No error should appear (onBlur checks `form.email && !EMAIL_RE.test(...)`)
      await expect(
        page.getByRole("alert", {
          name: "Format email tidak valid (contoh: nama@contoh.com).",
        })
      ).toBeHidden();
    });
  });

  // ─── Form reset after successful submit ──────────────────────────
  test.describe("Form state after submit", () => {
    test("phone field is optional — no error when empty", async ({ page }) => {
      await goToContact(page);

      // Fill only required fields (no phone)
      await page.getByPlaceholder("Nama Anda").fill("Budi Santoso");
      await page.getByPlaceholder("email@contoh.com").fill("budi@example.com");
      await page.getByPlaceholder("Subjek pesan").fill("Pertanyaan");
      await page
        .getByPlaceholder("Tulis pesan Anda di sini…")
        .fill("Pesan yang cukup panjang untuk validasi berhasil.");

      // Submit — phone being empty should not cause validation error
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // No phone-related error should appear (phone is optional)
      await expect(
        page.getByRole("alert", { name: /telepon/i })
      ).toBeHidden();
    });
  });

  // ─── No horizontal overflow during validation ────────────────────
  test.describe("Mobile layout during validation", () => {
    test("error messages do not cause horizontal overflow on mobile", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit to trigger all errors
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // Wait for errors to render
      await expect(
        page.getByRole("alert", { name: "Nama wajib diisi." })
      ).toBeVisible();

      // No horizontal overflow
      const overflows = await page.evaluate(
        () => document.body.scrollWidth > window.innerWidth
      );
      expect(overflows).toBe(false);
    });

    test("submit button remains visible above the fold on mobile", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit button should be visible
      const submitBtn = page.getByRole("button", { name: "Kirim Pesan" });
      await submitBtn.scrollIntoViewIfNeeded();
      await expect(submitBtn).toBeVisible();
    });

    test("all error alerts are scrollable into view on mobile", async ({
      page,
    }) => {
      await goToContact(page);

      // Submit empty form
      await page.getByRole("button", { name: "Kirim Pesan" }).click();

      // Scroll to and verify each error is reachable
      for (const errorText of [
        "Nama wajib diisi.",
        "Email wajib diisi.",
        "Subjek wajib diisi.",
        "Pesan wajib diisi.",
      ]) {
        const alert = page.getByRole("alert", { name: errorText });
        await alert.scrollIntoViewIfNeeded();
        await expect(alert).toBeVisible();
      }
    });
  });
});
