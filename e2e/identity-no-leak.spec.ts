import { test, expect, type APIRequest } from "./mutation-log";
import { ADMIN, login } from "./helpers";

// warmup: /api/org-structure /api/teachers /api/auth/login /api/csrf-token

const IDENTITY_KEYS = ["nuptk", "nip", "nik"] as const;

/**
 * GET publik dan kembalikan { status, json }. Dipakai fixture `request`
 * (bukan page.evaluate): relative path di-resolve terhadap baseURL config,
 * jadi test tidak perlu navigasi dulu (page.evaluate melawan about:blank
 * akan resolve ke origin yang salah).
 */
async function publicGet(request: APIRequest, path: string) {
  const res = await request.get(path);
  return { status: res.status(), json: await res.json() };
}

/** Pastikan objek (dan semua item bila array) tidak punya satu pun kunci identitas. */
function expectNoIdentityKeys(value: unknown, label: string) {
  const objects: Record<string, unknown>[] = Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : [value as Record<string, unknown>];
  for (const obj of objects) {
    for (const key of IDENTITY_KEYS) {
      expect(obj, `${label} tidak boleh memuat ${key}`).not.toHaveProperty(key);
    }
  }
}

test.describe("Kontrak no-leak identitas publik (NUPTK/NIP/NIK)", () => {
  test("GET /api/org-structure (publik) tidak memuat nuptk/nip/nik", async ({ request }) => {
    const { status, json } = await publicGet(request, "/api/org-structure");
    expect(status).toBe(200);
    // Bukan vacuous: seed publik memang punya anggota aktif.
    expect(json.items.length).toBeGreaterThan(0);
    expectNoIdentityKeys(json.items, "item org-structure publik");
  });

  test("GET /api/org-structure/[id] (publik) tidak memuat nuptk/nip/nik", async ({ request }) => {
    const list = await publicGet(request, "/api/org-structure");
    const id = (list.json.items as { id: string }[])[0].id;
    const { status, json } = await publicGet(request, `/api/org-structure/${id}`);
    expect(status).toBe(200);
    expectNoIdentityKeys(json.item, "detail org-structure publik");
  });

  test("GET /api/teachers (publik) tidak memuat nuptk/nip/nik", async ({ request }) => {
    const { status, json } = await publicGet(request, "/api/teachers");
    expect(status).toBe(200);
    expect(json.items.length).toBeGreaterThan(0);
    expectNoIdentityKeys(json.items, "item guru publik");
  });

  test("GET /api/teachers/[id] (publik) tidak memuat nuptk/nip/nik", async ({ request }) => {
    const list = await publicGet(request, "/api/teachers");
    const id = (list.json.items as { id: string }[])[0].id;
    const { status, json } = await publicGet(request, `/api/teachers/${id}`);
    expect(status).toBe(200);
    expectNoIdentityKeys(json.item, "detail guru publik");
  });

  test("kontrol positif: scope=admin MASIH memuat nuptk/nip/nik (strip hanya publik)", async ({
    page,
  }) => {
    // Login dulu agar scope=admin (requireAuth) lolos.
    await login(page, ADMIN.email, ADMIN.password);

    const orgAdmin = await page.evaluate(async () => {
      const res = await fetch("/api/org-structure?scope=admin");
      return { status: res.status, json: await res.json() };
    });
    expect(orgAdmin.status).toBe(200);
    const orgItem = (orgAdmin.json.items as Record<string, unknown>[])[0];
    for (const key of IDENTITY_KEYS) {
      expect(orgItem, `scope admin org-structure harus memuat ${key}`).toHaveProperty(key);
    }

    const teachersAdmin = await page.evaluate(async () => {
      const res = await fetch("/api/teachers?scope=admin");
      return { status: res.status, json: await res.json() };
    });
    expect(teachersAdmin.status).toBe(200);
    const teacherItem = (teachersAdmin.json.items as Record<string, unknown>[])[0];
    for (const key of IDENTITY_KEYS) {
      expect(teacherItem, `scope admin teachers harus memuat ${key}`).toHaveProperty(key);
    }
  });
});
