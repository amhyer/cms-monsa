/**
 * Unit test komponen StorageQuotaWidget (sidebar dashboard, SUPER_ADMIN):
 *
 * 1. Kuota terkonfigurasi → persen, bar, total bytes, jumlah file,
 *    dan kandidat cleanup tampil.
 * 2. Tanpa kuota (NEON_STORAGE_QUOTA_MB) → tanpa persen, total saja.
 * 3. Gagal fetch → tidak merender apa pun (sidebar tidak berisik).
 * 4. Klik widget → menuju beranda (rincian + aksi di panel beranda).
 * 5. Warna bar mengikuti tingkat pemakaian: <60% emerald, ≥60% amber,
 *    ≥80% merah (destructive) — konsisten dengan panel beranda.
 */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const push = vi.fn();
  const fetchMock = vi.fn(async () =>
    Response.json({
      ok: true,
      fileCount: 12,
      totalBytes: 262_144,
      byMimeType: [{ mimeType: "image/jpeg", count: 10, bytes: 200_000 }],
      quotaBytes: 1_048_576,
      usagePercent: 25,
      cleanupCandidates: 4,
      impact: null,
      alertState: null,
      timestamp: "2026-09-10T00:00:00.000Z",
    })
  );
  return { push, fetchMock };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}));

import { StorageQuotaWidget } from "../storage-quota-widget";

function okResponse(payload: object) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  h.fetchMock.mockClear();
  h.push.mockClear();
  vi.stubGlobal("fetch", h.fetchMock);
});

async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("StorageQuotaWidget", () => {
  it("menampilkan persen kuota, total, jumlah file, dan kandidat cleanup", async () => {
    render(<StorageQuotaWidget />);
    await flushAsync();

    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText(/256 KB · 12 file · 4 kandidat cleanup/)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /Pemakaian storage 25%/ })
    ).toBeInTheDocument();
  });

  const toneCases: [number, string][] = [
    [25, "bg-emerald-500"],
    [59, "bg-emerald-500"],
    [60, "bg-amber-500"],
    [79, "bg-amber-500"],
    [80, "bg-destructive"],
    [100, "bg-destructive"],
  ];

  it.each(toneCases)(
    "bar kuota %i%% berwarna sesuai tingkat (%s)",
    async (percent, expectedClass) => {
      h.fetchMock.mockImplementationOnce(async () =>
        okResponse({
          ok: true,
          fileCount: 12,
          totalBytes: 262_144,
          byMimeType: [],
          quotaBytes: 1_048_576,
          usagePercent: percent,
          cleanupCandidates: 0,
          impact: null,
          alertState: null,
          timestamp: "2026-09-10T00:00:00.000Z",
        })
      );

      render(<StorageQuotaWidget />);
      await flushAsync();

      const bar = screen.getByRole("progressbar", {
        name: new RegExp(`^Pemakaian storage ${percent}%$`),
      });
      // tone() menempel kelas warna via arbitrary variant pada root Progress,
      // jadi verifikasi substring kelasnya (bukan token kelas utuh).
      expect(bar.className).toContain(expectedClass);
    }
  );

  it("tanpa kuota → tanpa persen, hanya total + jumlah file", async () => {
    h.fetchMock.mockImplementationOnce(async () =>
      okResponse({
        ok: true,
        fileCount: 2,
        totalBytes: 20,
        byMimeType: [],
        quotaBytes: null,
        usagePercent: null,
        cleanupCandidates: 0,
        impact: null,
        alertState: null,
        timestamp: "2026-09-10T00:00:00.000Z",
      })
    );

    render(<StorageQuotaWidget />);
    await flushAsync();

    expect(screen.queryByText(/%\s*$/)).not.toBeInTheDocument();
    expect(screen.getByText(/20 B · 2 file$/)).toBeInTheDocument();
  });

  it("fetch gagal → tidak merender apa pun", async () => {
    h.fetchMock.mockRejectedValueOnce(new Error("network down"));

    const { container } = render(<StorageQuotaWidget />);
    await flushAsync();

    expect(container.innerHTML).toBe("");
  });

  it("klik widget → menuju beranda dashboard", async () => {
    render(<StorageQuotaWidget />);
    await flushAsync();

    await act(async () => {
      (
        screen.getByRole("button", { name: /Lihat rincian storage di beranda/ }) as HTMLButtonElement
      ).click();
    });

    expect(h.push).toHaveBeenCalledWith("/dashboard");
  });
});
