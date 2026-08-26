import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

// Mock email module — jangan sampai benar-benar kirim SMTP di test.
const mockSendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  emailTemplates: {
    testNotification: (name: string) => ({
      subject: "[CMS] Uji Kirim Email Berhasil",
      html: `<p>Halo ${name}</p>`,
    }),
  },
}));

import { POST, GET } from "@/app/api/notifications/test-email/route";

describe("/api/notifications/test-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    process.env.ADMIN_EMAIL = "admin@school.test";
    process.env.SMTP_USER = "smtp-user@school.test";
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.SMTP_USER;
  });

  it("mengirim email uji ke ADMIN_EMAIL saat berhasil", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockSendEmail.mockResolvedValue(true);

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST" }
    );
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.recipient).toBe("admin@school.test");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@school.test" })
    );
  });

  it("memprioritaskan recipient dari body di atas ADMIN_EMAIL", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockSendEmail.mockResolvedValue(true);

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST", body: { recipient: "ops@school.test" } }
    );
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recipient).toBe("ops@school.test");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@school.test" })
    );
  });

  it("fallback ke email user saat ADMIN_EMAIL tidak di-set", async () => {
    delete process.env.ADMIN_EMAIL;
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockSendEmail.mockResolvedValue(true);

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST" }
    );
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.recipient).toBe("test@example.com");
  });

  it("melaporkan sukses=false saat SMTP belum dikonfigurasi", async () => {
    delete process.env.SMTP_USER;
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockSendEmail.mockResolvedValue(false);

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST" }
    );
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.smtpConfigured).toBe(false);
    expect(data.error).toContain("SMTP belum dikonfigurasi");
  });

  it("melaporkan sukses=false saat pengiriman SMTP gagal", async () => {
    const user = createMockUser();
    mockRequireRole.mockResolvedValue({ ok: true, user });
    mockSendEmail.mockResolvedValue(false);

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST" }
    );
    const res = await POST(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.smtpConfigured).toBe(true);
  });

  it("menolak tanpa autentikasi", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const req = createMockRequest(
      "http://localhost/api/notifications/test-email",
      { method: "POST" }
    );
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("menolak GET dengan 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});