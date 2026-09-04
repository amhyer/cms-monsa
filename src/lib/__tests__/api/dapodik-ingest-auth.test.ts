import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest, asNextRequest } from "../test-utils";

// ─── Mocks ──────────────────────────────────────────────────────

const mockAuthenticateBridgeRequest = vi.fn();
const mockNormalizeDapodikPayload = vi.fn();
const mockApplyDapodikPayload = vi.fn();

vi.mock("@/lib/dapodik-bridge", () => ({
  authenticateBridgeRequest: (...a: unknown[]) =>
    mockAuthenticateBridgeRequest(...a),
}));

vi.mock("@/lib/dapodik-sync", () => ({
  normalizeDapodikPayload: (...a: unknown[]) =>
    mockNormalizeDapodikPayload(...a),
  applyDapodikPayload: (...a: unknown[]) => mockApplyDapodikPayload(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitPublicForm: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/dapodik-ingest-error", () => ({
  describeIngestError: vi.fn(() => ({ error: "fail" })),
  ingestErrorStatus: vi.fn(() => 502),
}));

const KEY = "test-secret-key-12345"; // 21 chars
const OK_RESULT = {
  sekolah: { updated: 0 },
  siswa: { created: 0, updated: 0, archived: 0, errors: 0 },
  gtk: { created: 0, updated: 0, archived: 0, errors: 0 },
  rombel: { created: 0, updated: 0, errors: 0 },
};

function postReq(headers: Record<string, string> = {}) {
  return asNextRequest(
    createMockRequest("http://localhost/api/dapodik/ingest", {
      method: "POST",
      body: { sekolah: { nama: "X", npsn: "1" } },
      headers,
    })
  );
}

function modularReq(
  dataType: string,
  payload: unknown,
  headers: Record<string, string> = {}
) {
  return asNextRequest(
    createMockRequest("http://localhost/api/dapodik/ingest", {
      method: "POST",
      body: { dataType, payload },
      headers,
    })
  );
}

// ─── Route integration — real auth, mocked downstream ───────────

import { POST } from "@/app/api/dapodik/ingest/route";

describe("POST /api/dapodik/ingest — route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SYNC_SECRET_KEY = KEY;
    mockNormalizeDapodikPayload.mockReturnValue({
      sekolah: { nama: "SD Test", npsn: "123" },
      siswa: [], gtk: [], rombel: [],
    });
    mockApplyDapodikPayload.mockResolvedValue(OK_RESULT);
  });

  afterEach(() => delete process.env.SYNC_SECRET_KEY);

  it("valid x-api-key → 200", async () => {
    const res = await POST(postReq({ "x-api-key": KEY }));
    expect(res.status).toBe(200);
    expect(mockNormalizeDapodikPayload).toHaveBeenCalled();
  });

  it("invalid x-api-key → 401", async () => {
    const res = await POST(postReq({ "x-api-key": "wrong" }));
    expect(res.status).toBe(401);
    expect(mockNormalizeDapodikPayload).not.toHaveBeenCalled();
  });

  it("no auth → 401", async () => {
    const res = await POST(postReq());
    expect(res.status).toBe(401);
  });

  it("valid Bearer → 200", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({ ok: true });
    const res = await POST(postReq({ Authorization: "Bearer tok" }));
    expect(res.status).toBe(200);
  });

  it("invalid Bearer → 401", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({
      ok: false, status: 401, error: "bad",
    });
    const res = await POST(postReq({ Authorization: "Bearer bad" }));
    expect(res.status).toBe(401);
  });

  it("x-api-key takes priority over Bearer", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({ ok: false, status: 401, error: "should not run" });
    const res = await POST(postReq({ "x-api-key": KEY, Authorization: "Bearer ignored" }));
    expect(res.status).toBe(200);
    expect(mockAuthenticateBridgeRequest).not.toHaveBeenCalled();
  });

  it("ping → 200 without calling normalize/apply", async () => {
    const r = asNextRequest(
      createMockRequest("http://localhost/api/dapodik/ingest", {
        method: "POST", body: { ping: true }, headers: { "x-api-key": KEY },
      })
    );
    const res = await POST(r);
    expect(res.status).toBe(200);
    expect(mockNormalizeDapodikPayload).not.toHaveBeenCalled();
  });

  it("invalid JSON → 400", async () => {
    const r = new Request("http://localhost/api/dapodik/ingest", {
      method: "POST",
      headers: { "x-api-key": KEY, "Content-Type": "text/plain" },
      body: "not json",
    });
    const res = await POST(asNextRequest(r));
    expect(res.status).toBe(400);
  });

  it("modular {dataType, payload} → { success, message, count }", async () => {
    const payload = [
      { ptkId: "1", nama: "Guru A" },
      { ptkId: "2", nama: "Guru B" },
    ];
    const res = await POST(modularReq("gtk", payload, { "x-api-key": KEY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      message: "Modul [gtk] batch berhasil diproses",
      count: payload.length,
      sekolah: { updated: 0 },
    });
  });

  it("modular payload as object (sekolah) → count 1", async () => {
    const res = await POST(
      modularReq("sekolah", { nama: "SD X", npsn: "1" }, { "x-api-key": KEY })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
  });

  it("full-format body keeps legacy { ok: true } response", async () => {
    const res = await POST(postReq({ "x-api-key": KEY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.success).toBeUndefined();
  });

  it("unknown dataType → 502 via describeIngestError", async () => {
    mockNormalizeDapodikPayload.mockImplementation(() => {
      throw new Error("dataType tidak dikenal");
    });
    const res = await POST(modularReq("bogus", [], { "x-api-key": KEY }));
    expect(res.status).toBe(502);
    expect(JSON.parse(await res.text())).toEqual({ error: "fail" });
  });
});

// ─── authenticateIngestRequest — unit (real safeCompare) ────────

import { authenticateIngestRequest } from "@/lib/dapodik-auth";

describe("authenticateIngestRequest — x-api-key", () => {
  afterEach(() => delete process.env.SYNC_SECRET_KEY);

  it("accepts valid key", async () => {
    process.env.SYNC_SECRET_KEY = KEY;
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { "x-api-key": KEY } })
    );
    expect(res).toEqual({ ok: true });
  });

  it("rejects same-length wrong key via timingSafeEqual", async () => {
    process.env.SYNC_SECRET_KEY = KEY;
    const wrong = "a".repeat(KEY.length); // 21 chars, all different
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { "x-api-key": wrong } })
    );
    expect(res).toEqual({ ok: false, status: 401, error: "API key tidak valid." });
  });

  it("rejects different-length key via RangeError catch", async () => {
    process.env.SYNC_SECRET_KEY = KEY;
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { "x-api-key": "short" } })
    );
    expect(res).toEqual({ ok: false, status: 401, error: "API key tidak valid." });
  });

  it("500 when SYNC_SECRET_KEY is unset", async () => {
    delete process.env.SYNC_SECRET_KEY;
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { "x-api-key": "any" } })
    );
    expect(res).toEqual({ ok: false, status: 500, error: "SYNC_SECRET_KEY belum diatur di server." });
  });

  it("401 with no auth headers", async () => {
    const res = await authenticateIngestRequest(new Request("http://x"));
    expect(res).toEqual({
      ok: false, status: 401,
      error: "Autentikasi wajib: kirim x-api-key atau Authorization: Bearer.",
    });
  });
});

describe("authenticateIngestRequest — bridge fallback", () => {
  afterEach(() => {
    delete process.env.SYNC_SECRET_KEY;
    mockAuthenticateBridgeRequest.mockReset();
  });

  it("delegates to bridge when no x-api-key", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({ ok: true });
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { Authorization: "Bearer tok" } })
    );
    expect(res).toEqual({ ok: true });
    expect(mockAuthenticateBridgeRequest).toHaveBeenCalled();
  });

  it("returns bridge error on invalid token", async () => {
    mockAuthenticateBridgeRequest.mockResolvedValue({
      ok: false, status: 401, error: "bad",
    });
    const res = await authenticateIngestRequest(
      new Request("http://x", { headers: { Authorization: "Bearer bad" } })
    );
    expect(res).toEqual({ ok: false, status: 401, error: "bad" });
  });

  it("x-api-key takes priority over bridge", async () => {
    process.env.SYNC_SECRET_KEY = KEY;
    const res = await authenticateIngestRequest(
      new Request("http://x", {
        headers: { "x-api-key": KEY, Authorization: "Bearer ignored" },
      })
    );
    expect(res).toEqual({ ok: true });
    expect(mockAuthenticateBridgeRequest).not.toHaveBeenCalled();
  });
});
