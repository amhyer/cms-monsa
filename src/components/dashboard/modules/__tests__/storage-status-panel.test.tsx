/**
 * Unit test komponen StorageStatusPanel (beranda dashboard, SUPER_ADMIN):
 *
 * 1. Kuota terkonfigurasi → persen pemakaian + total/kuota bytes.
 * 2. Kandidat cleanup, dampak referensi (risiko 404 + entitas perujuk),
 *    dan status alert terakhir (di atas ambang) tampil.
 * 3. Alert belum pernah jalan / impact null → label fallback.
 * 4. Tanpa kuota (NEON_STORAGE_QUOTA_MB) → total saja + petunjuk env.
 * 5. Non-admin → tidak merender apa pun, tidak memanggil API.
 * 6. Gagal fetch → kartu error dengan tombol coba lagi.
 * 7. Tombol Uji Kirim Alert → POST /api/notifications/test-alert,
 *    hasil sukses/gagal tampil inline; sukses memicu refresh statistik.
 * 8. alertState.lastTestedAt → baris "Diuji:" + hint tombol berisi waktu
 *    uji terakhir; tanpa lastTestedAt → hint default.
 * 9. Interval muat-ulang: pilihan Mati/30d/1m/5m; memilih interval persisten
 *    ke localStorage; nilai tersimpan yang valid dipakai ulang saat mount;
 *    nilai tidak valid diabaikan; perubahan interval memicu pengaturan ulang
 *    timer (pengambilan data lebih cepat).
 */

import { render, screen, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// fetch router + store mock dibangun di vi.hoisted agar bisa dioverride
// per-tes (role non-admin) dari dalam tes.
const h = vi.hoisted(() => {
  const adminUser = {
    id: "admin-1",
    name: "Admin",
    role: "SUPER_ADMIN",
    isActive: true,
  };
  const useAppStore = vi.fn((selector: (s: { user: unknown }) => unknown) =>
    selector({ user: adminUser })
  );
  const fetchMock = vi.fn(async () =>
    Response.json({
      ok: true,
      fileCount: 5,
      totalBytes: 800_000,
      byMimeType: [
        { mimeType: "image/jpeg", count: 3, bytes: 600_000 },
        { mimeType: "application/pdf", count: 2, bytes: 200_000 },
      ],
      quotaBytes: 524_288,
      usagePercent: 152.6,
      cleanupCandidates: 3,
      impact: {
        referencedCandidates: 2,
        safeCandidates: 1,
        byEntity: { News: 1, GalleryItem: 1 },
      },
      alertState: {
        aboveThreshold: true,
        lastAlertedAt: "2026-09-08T19:00:00.000Z",
        lastUsagePercent: 95.4,
        lastSendAt: "2026-09-09T03:00:00.000Z",
        lastChannelsWhatsapp: true,
        lastChannelsTelegram: false,
        lastTestedAt: "2026-09-10T02:00:00.000Z",
        lastTestSendAt: "2026-09-10T02:00:00.000Z",
        lastTestChannelsWhatsapp: false,
        lastTestChannelsTelegram: true,
      },
      timestamp: "2026-09-09T00:00:00.000Z",
    })
  );
  return { useAppStore, fetchMock };
});

vi.mock("@/store/app", () => ({ useAppStore: h.useAppStore }));

import { StorageStatusPanel } from "../storage-status-panel";

function okResponse(payload: object) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  h.fetchMock.mockClear();
  h.useAppStore.mockClear();
  h.useAppStore.mockImplementation((selector) =>
    selector({
      user: { id: "admin-1", name: "Admin", role: "SUPER_ADMIN", isActive: true },
    })
  );
  vi.stubGlobal("fetch", h.fetchMock);
});

async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("StorageStatusPanel", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("menampilkan kuota, kandidat, dampak, dan status alert", async () => {
    render(<StorageStatusPanel />);
    await flushAsync();

    // Kuota: 800.000 B (781 KB) dari 524.288 B (512 KB) → 152.6%
    // (toFixed memakai titik desimal, formatBytes membulatkan ke atas)
    expect(screen.getByText(/152\.6%/)).toBeInTheDocument();
    expect(screen.getByText(/781 KB \/ 512 KB/)).toBeInTheDocument();
    // Melewati ambang default 80%
    expect(screen.getByText(/Melewati ambang alert/)).toBeInTheDocument();

    // Kandidat cleanup
    expect(screen.getByText("Kandidat cleanup")).toBeInTheDocument();
    expect(screen.getByText("3 file")).toBeInTheDocument();

    // Dampak referensi — berisiko 404 + entitas perujuk
    expect(screen.getByText("2 file berisiko 404")).toBeInTheDocument();
    expect(screen.getByText(/News \(1\), GalleryItem \(1\)/)).toBeInTheDocument();

    // Status alert: di atas ambang + waktu notifikasi + uji manual terakhir
    expect(screen.getByText(/Di atas ambang · 95\.4%/)).toBeInTheDocument();
    expect(screen.getByText(/Notif:/)).toBeInTheDocument();
    expect(screen.getByText(/Diuji:/)).toBeInTheDocument();
    // Hint tombol memakai waktu uji terakhir
    expect(screen.getByText(/Jalur terakhir diuji:/)).toBeInTheDocument();
    // Kesehatan pengiriman: cron vs uji manual, hasil per kanal
    expect(screen.getByText(/Kirim cron:/)).toBeInTheDocument();
    expect(screen.getByText(/WA ok, TG gagal/)).toBeInTheDocument();
    expect(screen.getByText(/Uji manual:/)).toBeInTheDocument();
  });

  it("impact null → tidak diketahui; alert belum jalan → belum pernah berjalan; tanpa kuota → petunjuk env", async () => {
    h.fetchMock.mockImplementationOnce(async () =>
      okResponse({
        ok: true,
        fileCount: 1,
        totalBytes: 10,
        byMimeType: [],
        quotaBytes: null,
        usagePercent: null,
        cleanupCandidates: 0,
        impact: null,
        alertState: null,
        timestamp: "2026-09-09T00:00:00.000Z",
      })
    );

    render(<StorageStatusPanel />);
    await flushAsync();

    expect(screen.getByText(/Tidak diketahui/)).toBeInTheDocument();
    expect(screen.getByText(/Belum pernah berjalan/)).toBeInTheDocument();
    expect(screen.getByText(/NEON_STORAGE_QUOTA_MB/)).toBeInTheDocument();
    // Tanpa state sama sekali → kedua baris kesehatan "belum pernah"
    expect(screen.getAllByText(/belum pernah/).length).toBeGreaterThanOrEqual(2);
    // Tanpa lastTestedAt → hint default (bukan "Jalur terakhir diuji")
    expect(
      screen.getByText(
        /Kirim pesan uji ke admin via WhatsApp\/Telegram/
      )
    ).toBeInTheDocument();
  });

  it("non-admin → tidak merender apa pun dan tidak memanggil API", async () => {
    h.useAppStore.mockImplementation((selector) =>
      selector({ user: { id: "g1", name: "Guru", role: "GURU", isActive: true } })
    );

    const { container } = render(<StorageStatusPanel />);
    await flushAsync();

    expect(container.innerHTML).toBe("");
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it("fetch gagal → kartu error dengan tombol coba lagi", async () => {
    h.fetchMock.mockRejectedValueOnce(new Error("network down"));

    render(<StorageStatusPanel />);
    await flushAsync();

    expect(screen.getByText(/Gagal memuat laporan storage/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Coba lagi/ })
    ).toBeInTheDocument();
  });

  it("Uji Kirim Alert → POST test-alert dan tampilkan hasil sukses", async () => {
    render(<StorageStatusPanel />);
    await flushAsync();

    // Respons route untuk klik berikutnya (GET storage-usage sudah memakai
    // mock default).
    h.fetchMock.mockImplementationOnce(async () =>
      okResponse({
        success: true,
        channels: { whatsapp: false, telegram: true },
        message: "Alert uji terkirim via Telegram.",
      })
    );

    await act(async () => {
      (screen.getByRole("button", { name: /Uji Kirim Alert/ }) as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(h.fetchMock).toHaveBeenCalledWith("/api/notifications/test-alert", {
      method: "POST",
    });
    expect(screen.getByText(/terkirim via Telegram/)).toBeInTheDocument();

    // Sukses → panel memuat ulang statistik agar baris "Diuji:" memakai
    // lastTestedAt yang baru tersimpan.
    const usageCalls = (
      h.fetchMock.mock.calls as unknown as [string, unknown?][]
    ).filter(([url]) => url === "/api/storage-usage");
    expect(usageCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("Uji Kirim Alert gagal (success:false) → pesan error tampil inline", async () => {
    render(<StorageStatusPanel />);
    await flushAsync();

    h.fetchMock.mockImplementationOnce(async () =>
      okResponse({
        success: false,
        whatsappConfigured: false,
        telegramConfigured: false,
        error: "Tidak ada kanal aktif. Set ADMIN_PHONE + FONNTE_TOKEN.",
      })
    );

    await act(async () => {
      (screen.getByRole("button", { name: /Uji Kirim Alert/ }) as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText(/Tidak ada kanal aktif/)).toBeInTheDocument();
    // Tombol kembali aktif setelah gagal — bisa dicoba ulang.
    expect(
      (screen.getByRole("button", { name: /Uji Kirim Alert/ }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("interval: tombol Mati aktif saat mount tanpa preferensi; memilih 1m persisten ke localStorage", async () => {
    render(<StorageStatusPanel />);
    await flushAsync();

    const group = screen.getByRole("group", { name: /Interval muat-ulang/ });
    const opts = [
      ...within(group).getAllByRole("button"),
    ] as HTMLButtonElement[];
    expect(opts.map((b) => b.textContent)).toEqual(["Mati", "30d", "1m", "5m"]);
    // Default tanpa preferensi: Mati aktif (aria-pressed), lainnya tidak.
    expect(opts.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);

    await act(async () => {
      opts[2].click();
    });

    expect(opts[2].getAttribute("aria-pressed")).toBe("true");
    expect(opts[0].getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("cms.storage-panel-refresh-ms")).toBe(
      "60000"
    );
  });

  it("interval tersimpan yang valid dipakai ulang saat mount; tidak valid diabaikan", async () => {
    window.localStorage.setItem("cms.storage-panel-refresh-ms", "30000");

    render(<StorageStatusPanel />);
    await flushAsync();

    const group = screen.getByRole("group", { name: /Interval muat-ulang/ });
    const pressed = within(group)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["false", "true", "false", "false"]);
  });

  it("mengganti interval memicu fetch ulang segera lalu jadwal baru; Mati menghentikan timer", async () => {
    vi.useFakeTimers();
    try {
      render(<StorageStatusPanel />);
      // Mount + resolve fetch awal di bawah fake timers.
      await act(async () => {});

      const callsAt = () =>
        (h.fetchMock.mock.calls as unknown as [string][]).filter(
          ([url]) => url === "/api/storage-usage"
        ).length;
      const before = callsAt();
      expect(before).toBeGreaterThanOrEqual(1);

      // Default Mati: tanpa timer — 2 menit tidak memicu apa pun.
      await act(async () => {
        vi.advanceTimersByTime(120_000);
      });
      expect(callsAt()).toBe(before);

      // Aktifkan interval 30 detik → fetch ulang segera (efek re-run pada
      // perubahan refreshMs), lalu jadwal baru.
      const opt30s = within(
        screen.getByRole("group", { name: /Interval muat-ulang/ })
      )
        .getAllByRole("button")[1] as HTMLButtonElement;
      await act(async () => {
        opt30s.click();
      });
      expect(callsAt()).toBe(before + 1);

      // Belum ada fetch lagi sebelum interval tercapai.
      await act(async () => {
        vi.advanceTimersByTime(29_999);
      });
      expect(callsAt()).toBe(before + 1);

      // Tepat 30 detik setelah pemilihan → satu fetch dari interval.
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(callsAt()).toBe(before + 2);

      // Kembali ke Mati → fetch segera dari re-run efek, tanpa fetch
      // terjadwal berikutnya.
      const optOff = within(
        screen.getByRole("group", { name: /Interval muat-ulang/ })
      )
        .getAllByRole("button")[0] as HTMLButtonElement;
      await act(async () => {
        optOff.click();
      });
      expect(callsAt()).toBe(before + 3);
      await act(async () => {
        vi.advanceTimersByTime(300_000);
      });
      expect(callsAt()).toBe(before + 3);
    } finally {
      vi.useRealTimers();
    }
  });
});
