import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockRequireRole = vi.fn();
const mockRequireAuth = vi.fn();
const mockGetDapodikClient = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

vi.mock("@/lib/dapodik-sync", () => ({
  getDapodikClient: (...args: unknown[]) => mockGetDapodikClient(...args),
}));

import { POST } from "@/app/api/dapodik/route";

// Client tiruan — tiap method adalah spy supaya bisa dicek method mana yang
// benar-benar dipanggil (regresi: alias "siswa"/"guru" tidak boleh menarik
// semua data).
function makeMockClient() {
  return {
    getSekolah: vi.fn(async () => ({
      nama: "SD Negeri Test",
      npsn: "40313912",
      alamat: "Jl. Test No. 1",
    })),
    getPesertaDidik: vi.fn(async () => [
      { peserta_didik_id: "pd-1", nama: "Siswa Satu", rombongan_belajar_id: "rb-1" },
    ]),
    getGTK: vi.fn(async () => [{ nama: "Guru Satu", nuptk: "1234567890" }]),
    getRombonganBelajar: vi.fn(async () => [
      { rombongan_belajar_id: "rb-1", nama: "Kelas 1A" },
    ]),
  };
}

describe("POST /api/dapodik — alias endpoint", () => {
  let client: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    client = makeMockClient();
    mockGetDapodikClient.mockReturnValue(client);
  });

  it('endpoint "siswa" memanggil getPesertaDidik saja (bukan semua data)', async () => {
    const req = createMockRequest("http://localhost/api/dapodik", {
      method: "POST",
      body: { endpoint: "siswa" },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.peserta_didik).toHaveLength(1);
    expect(json.data.gtk).toBeUndefined();
    expect(json.data.sekolah).toBeUndefined();
    expect(json.data.rombel).toBeUndefined();

    expect(client.getPesertaDidik).toHaveBeenCalledTimes(1);
    expect(client.getGTK).not.toHaveBeenCalled();
    expect(client.getSekolah).not.toHaveBeenCalled();
    expect(client.getRombonganBelajar).not.toHaveBeenCalled();
  });

  it('endpoint "guru" memanggil getGTK saja (bukan semua data)', async () => {
    const req = createMockRequest("http://localhost/api/dapodik", {
      method: "POST",
      body: { endpoint: "guru" },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.gtk).toHaveLength(1);
    expect(json.data.peserta_didik).toBeUndefined();

    expect(client.getGTK).toHaveBeenCalledTimes(1);
    expect(client.getPesertaDidik).not.toHaveBeenCalled();
    expect(client.getSekolah).not.toHaveBeenCalled();
    expect(client.getRombonganBelajar).not.toHaveBeenCalled();
  });

  it('endpoint kanonik "peserta_didik" dan "gtk" tetap berfungsi', async () => {
    for (const endpoint of ["peserta_didik", "gtk"]) {
      const req = createMockRequest("http://localhost/api/dapodik", {
        method: "POST",
        body: { endpoint },
      });
      const res = await POST(asNextRequest(req));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    }
    expect(client.getPesertaDidik).toHaveBeenCalledTimes(1);
    expect(client.getGTK).toHaveBeenCalledTimes(1);
    expect(client.getSekolah).not.toHaveBeenCalled();
    expect(client.getRombonganBelajar).not.toHaveBeenCalled();
  });

  it('endpoint "sekolah" dan "rombel" hanya memanggil method masing-masing', async () => {
    for (const endpoint of ["sekolah", "rombel"]) {
      const req = createMockRequest("http://localhost/api/dapodik", {
        method: "POST",
        body: { endpoint },
      });
      const res = await POST(asNextRequest(req));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    }

    expect(client.getSekolah).toHaveBeenCalledTimes(1);
    expect(client.getRombonganBelajar).toHaveBeenCalledTimes(1);
    expect(client.getPesertaDidik).not.toHaveBeenCalled();
    expect(client.getGTK).not.toHaveBeenCalled();
  });

  it("endpoint tak dikenal jatuh ke default: menarik SEMUA data (perilaku lama)", async () => {
    const req = createMockRequest("http://localhost/api/dapodik", {
      method: "POST",
      body: { endpoint: "tidak-ada" },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.peserta_didik).toHaveLength(1);
    expect(json.data.gtk).toHaveLength(1);

    expect(client.getSekolah).toHaveBeenCalledTimes(1);
    expect(client.getPesertaDidik).toHaveBeenCalledTimes(1);
    expect(client.getGTK).toHaveBeenCalledTimes(1);
    expect(client.getRombonganBelajar).toHaveBeenCalledTimes(1);
  });

  it("menolak tanpa role yang cukup", async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });

    const req = createMockRequest("http://localhost/api/dapodik", {
      method: "POST",
      body: { endpoint: "siswa" },
    });
    const res = await POST(asNextRequest(req));
    expect(res.status).toBe(403);
    expect(mockGetDapodikClient).not.toHaveBeenCalled();
  });

  it("mengembalikan 502 dengan pesan error saat client Dapodik gagal", async () => {
    mockGetDapodikClient.mockRejectedValue(new Error("HTTP 500: Internal Server Error"));

    const req = createMockRequest("http://localhost/api/dapodik", {
      method: "POST",
      body: { endpoint: "siswa" },
    });
    const res = await POST(asNextRequest(req));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toContain("HTTP 500");
  });
});
