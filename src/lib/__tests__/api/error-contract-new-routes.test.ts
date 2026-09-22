/**
 * Kontrak proteksi error handler mutasi (regresi untuk gate P1-1).
 *
 * Setiap handler mutasi wajib: error internal → 500 tersanitasi
 * ("Terjadi kesalahan server.") + tepat satu logger.error, TANPA
 * detail internal (stack/message Prisma) bocor ke klien. Guard
 * (401/403/400) harus tetap lolos apa adanya.
 *
 * Diuji di sini: rute-rute yang ditambahkan proteksinya pada
 * penguatan gate 2026-09-22 (sebelumnya lolos gate lama karena
 * kata "catch" dari .catch() pada req.json()).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockPrisma,
  mockCookies,
  createMockRequest,
  createMockUser,
  asNextRequest,
} from "../test-utils";

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  updateSessionRole: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/dapodik-scheduler", () => ({
  getAutoSyncStatus: vi.fn(),
  setAutoSyncSettings: vi.fn(() => Promise.reject(new Error(SECRET))),
  sanitizeIntervalHours: (n: number) => n,
}));

import { logger } from "@/lib/logger";

import { PUT as contactPUT, DELETE as contactDELETE } from "@/app/api/contact-messages/[id]/route";
import { POST as orgStructurePOST } from "@/app/api/org-structure/route";
import { POST as teachersPOST } from "@/app/api/teachers/route";
import { POST as autoSyncPOST } from "@/app/api/dapodik/auto-sync/route";

const SECRET = "rahasia-internal: P2003 constraint User_guardianClassId_fkey";

/** Tepat satu logger.error dengan objek berisi err — kontrak logging server. */
function expectOneErrorLog() {
  expect(logger.error).toHaveBeenCalledTimes(1);
  const payload = vi.mocked(logger.error).mock.calls[0][0] as { err: unknown };
  const msg =
    typeof payload.err === "object" && payload.err !== null
      ? String((payload.err as { message?: string }).message)
      : String(payload.err);
  expect(msg).toContain(SECRET);
}

async function expectSanitized500(res: Response) {
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body).toEqual({ error: "Terjadi kesalahan server." });
  expect(JSON.stringify(body)).not.toContain(SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookies.store = {};
  mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
});

describe("Kontrak error handler mutasi (500 tersanitasi + logger.error)", () => {
  it("contact-messages PUT: DB gagal → 500 sanitiz + 1 log error; update tidak salah sasaran", async () => {
    mockPrisma.contactMessage.update.mockRejectedValue(new Error(SECRET));
    const res = await contactPUT(
      asNextRequest(createMockRequest("http://localhost/api/contact-messages/x", {
        method: "PUT",
        body: { isRead: true },
      })),
      { params: Promise.resolve({ id: "x" }) }
    );
    await expectSanitized500(res);
    expectOneErrorLog();
  });

  it("contact-messages DELETE: DB gagal → 500 sanitiz + 1 log error", async () => {
    mockPrisma.contactMessage.delete.mockRejectedValue(new Error(SECRET));
    const res = await contactDELETE(
      asNextRequest(createMockRequest("http://localhost/api/contact-messages/x", { method: "DELETE" })),
      { params: Promise.resolve({ id: "x" }) }
    );
    await expectSanitized500(res);
    expectOneErrorLog();
  });

  it("contact-messages DELETE happy path tetap 200 dan menghapus", async () => {
    mockPrisma.contactMessage.delete.mockResolvedValue({ id: "x" });
    const res = await contactDELETE(
      asNextRequest(createMockRequest("http://localhost/api/contact-messages/x", { method: "DELETE" })),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.contactMessage.delete).toHaveBeenCalledWith({ where: { id: "x" } });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("org-structure POST: DB gagal → 500 sanitiz + 1 log error", async () => {
    mockPrisma.orgStructure.count.mockResolvedValue(0);
    mockPrisma.orgStructure.create.mockRejectedValue(new Error(SECRET));
    const res = await orgStructurePOST(
      asNextRequest(createMockRequest("http://localhost/api/org-structure", {
        method: "POST",
        body: { name: "Rina", position: "Guru Kelas" },
      }))
    );
    await expectSanitized500(res);
    expectOneErrorLog();
  });

  it("teachers POST: DB gagal → 500 sanitiz + 1 log error", async () => {
    mockPrisma.teacher.count.mockResolvedValue(0);
    mockPrisma.teacher.create.mockRejectedValue(new Error(SECRET));
    const res = await teachersPOST(
      asNextRequest(createMockRequest("http://localhost/api/teachers", {
        method: "POST",
        body: { name: "Budi", position: "Operator" },
      }))
    );
    await expectSanitized500(res);
    expectOneErrorLog();
  });

  it("dapodik auto-sync POST: scheduler gagal → 500 sanitiz + 1 log error", async () => {
    const res = await autoSyncPOST(
      asNextRequest(createMockRequest("http://localhost/api/dapodik/auto-sync", {
        method: "POST",
        body: { enabled: false, intervalHours: 24 },
      }))
    );
    await expectSanitized500(res);
    expectOneErrorLog();
  });

  it("org-structure POST: guard 403 lolos apa adanya (tanpa try/catch mengubah respons)", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Terlarang." }), { status: 403 }),
    });
    const res = await orgStructurePOST(
      asNextRequest(createMockRequest("http://localhost/api/org-structure", {
        method: "POST",
        body: { name: "Rina", position: "Guru" },
      }))
    );
    expect(res.status).toBe(403);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
