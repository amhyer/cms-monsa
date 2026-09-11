/**
 * Unit test GET /api/notifications/health — fokus pada blok `storageAlert`
 * (hasil kirim cron alert kuota terakhir dari StorageAlertState):
 *
 * 1. Tanpa cookie sesi → 401 (hanya OPERATOR ke atas).
 * 2. Row StorageAlertState ada → blok storageAlert memuat hasil kanal.
 * 3. Row belum ada (cron belum pernah jalan) → storageAlert null,
 *    kesehatan kanal lain tetap terbit.
 * 4. Tabel gagal dibaca (belum bermigrasi) → storageAlert null (fail-soft).
 */

import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findUnique: vi.fn(),
  activityFindFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/db", () => ({
  db: {
    storageAlertState: { findUnique: h.findUnique },
    activityLog: { findFirst: h.activityFindFirst },
  },
}));

import { GET } from "@/app/api/notifications/health/route";

function deniedResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

beforeEach(() => {
  h.requireRole.mockReset();
  h.findUnique.mockReset();
  h.activityFindFirst.mockReset();
  // Health route membaca 1 log per kanal (email/whatsapp/telegram).
  h.activityFindFirst.mockResolvedValue(null);
});

describe("GET /api/notifications/health — storageAlert", () => {
  it("401 tanpa sesi", async () => {
    h.requireRole.mockResolvedValue({ ok: false, response: deniedResponse() });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("row StorageAlertState ada → blok storageAlert memuat hasil kanal", async () => {
    h.requireRole.mockResolvedValue({
      ok: true,
      user: { id: "a1", role: "SUPER_ADMIN" },
    });
    h.findUnique.mockResolvedValue({
      id: "singleton",
      aboveThreshold: true,
      lastAlertedAt: new Date("2026-09-08T03:00:00.000Z"),
      lastUsagePercent: 95.4,
      lastSendAt: new Date("2026-09-09T03:00:00.000Z"),
      lastChannelsWhatsapp: true,
      lastChannelsTelegram: false,
      lastTestedAt: new Date("2026-09-10T02:30:00.000Z"),
      lastTestSendAt: new Date("2026-09-10T02:30:00.000Z"),
      lastTestChannelsWhatsapp: true,
      lastTestChannelsTelegram: false,
    });

    const res = await GET();
    const json = (await res.json()) as {
      storageAlert: {
        aboveThreshold: boolean;
        lastSendAt: string | null;
        lastChannelsWhatsapp: boolean | null;
        lastChannelsTelegram: boolean | null;
        lastTestSendAt: string | null;
        lastTestChannelsWhatsapp: boolean | null;
        lastTestChannelsTelegram: boolean | null;
      } | null;
    };

    expect(json.storageAlert).toEqual({
      aboveThreshold: true,
      lastSendAt: "2026-09-09T03:00:00.000Z",
      lastChannelsWhatsapp: true,
      lastChannelsTelegram: false,
      // Catatan uji manual ikut diekspos, terpisah dari kirim cron.
      lastTestSendAt: "2026-09-10T02:30:00.000Z",
      lastTestChannelsWhatsapp: true,
      lastTestChannelsTelegram: false,
    });
  });

  it("row belum ada → storageAlert null, kesehatan kanal tetap terbit", async () => {
    h.requireRole.mockResolvedValue({
      ok: true,
      user: { id: "a1", role: "OPERATOR" },
    });
    h.findUnique.mockResolvedValue(null);

    const res = await GET();
    const json = (await res.json()) as {
      smtp: { configured: boolean };
      storageAlert: unknown;
    };

    expect(json.storageAlert).toBeNull();
    expect(json.smtp).toBeDefined();
  });

  it("tabel gagal dibaca → storageAlert null (fail-soft, tidak 500)", async () => {
    h.requireRole.mockResolvedValue({
      ok: true,
      user: { id: "a1", role: "SUPER_ADMIN" },
    });
    h.findUnique.mockRejectedValue(new Error("P2021 table does not exist"));

    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { storageAlert: unknown };
    expect(json.storageAlert).toBeNull();
  });
});
