import { afterEach, describe, expect, it, vi } from "vitest";
import { DapodikClient } from "@/lib/dapodik-client";

function makeClient() {
  return new DapodikClient({
    npsn: "40313912",
    token: "test-token",
    host: "localhost",
    port: 5774,
    protocol: "http",
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DapodikClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPesertaDidik menggabungkan semua halaman (pagination start/limit)", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => ({
      id: `pd-${i + 1}`,
      peserta_didik_id: `pd-${i + 1}`,
      nama: `Siswa ${i + 1}`,
    }));
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        calls.push(String(url));
        const u = new URL(String(url));
        const start = Number(u.searchParams.get("start") ?? 0);
        const limit = Number(u.searchParams.get("limit") ?? 100);
        return jsonResponse({ rows: rows.slice(start, start + limit) });
      })
    );

    const client = makeClient();
    const result = await client.getPesertaDidik();

    expect(result).toHaveLength(150);
    expect(calls.length).toBeGreaterThan(1); // harus memuat lebih dari 1 halaman
  });

  it("tidak infinite-loop kalau Dapodik mengabaikan start/limit (guard dedupe)", async () => {
    const rows = [{ id: "pd-1", peserta_didik_id: "pd-1", nama: "Siswa 1" }];
    const fetchMock = vi.fn(async () => jsonResponse({ rows }));
    vi.stubGlobal("fetch", fetchMock);

    const client = makeClient();
    const result = await client.getPesertaDidik();

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2); // halaman pertama + deteksi duplikat
  });

  it("getPesertaDidik meneruskan semester_id & tahun_ajaran_id saat difilter", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        urls.push(String(url));
        return jsonResponse({ rows: [] });
      })
    );

    const client = makeClient();
    await client.getPesertaDidik("20261");

    const u = new URL(urls[0] ?? "http://x");
expect(u.searchParams.get("semester_id")).toBe("20261");
    expect(u.searchParams.get("tahun_ajaran_id")).toBe("2026/2027");
  });

  it("melempar error jelas saat respons bukan JSON (token salah / belum whitelist)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Access denied</html>", { status: 200 }))
    );

    const client = makeClient();
    await expect(client.getSekolah()).rejects.toThrow(/bukan JSON valid/);
  });

  it("getSemesters mengumpulkan semester_id unik dari peserta didik + rombel (urutan menurun)", async () => {
    const pdRows = [
      { id: "pd-1", peserta_didik_id: "pd-1", nama: "A", semester_id: "20252" },
      { id: "pd-2", peserta_didik_id: "pd-2", nama: "B", semester_id: "20261" },
      { id: "pd-3", peserta_didik_id: "pd-3", nama: "C", semester_id: "20252" },
    ];
    const rbRows = [
      { id: "rb-1", rombongan_belajar_id: "rb-1", nama: "Kelas VI.a", semester_id: "20261" },
      { id: "rb-2", rombongan_belajar_id: "rb-2", nama: "Kelas VI.b", semester_id: "20241" },
    ];

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return jsonResponse({ rows: pdRows });
        return jsonResponse({ rows: rbRows });
      })
    );

    const client = makeClient();
    const result = await client.getSemesters();

    expect(result).toEqual(["20261", "20252", "20241"]);
  });

  it("getSemesters tetap mengembalikan daftar dari peserta didik bila rombel gagal", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return jsonResponse({ rows: [{ id: "pd-1", peserta_didik_id: "pd-1", nama: "A", semester_id: "20261" }] });
        }
        if (call === 2) return jsonResponse({ rows: [] }); // PD selesai
        return jsonResponse({ error: "boom" }, 500); // rombel gagal
      })
    );

    const client = makeClient();
    const result = await client.getSemesters();

    expect(result).toEqual(["20261"]);
  });
});
