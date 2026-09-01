import { afterEach, describe, expect, it, vi } from "vitest";

// Mock db minimal — cukup dapodikConfig untuk getDapodikClient/saveDapodikConfig.
// vi.hoisted: objek mock harus tersedia SEBELUM import @/lib/dapodik-sync dijalankan
// (factory vi.mock dievaluasi saat modul yang di-mock pertama kali di-import).
const { mockDapodikConfig } = vi.hoisted(() => ({
  mockDapodikConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { dapodikConfig: mockDapodikConfig },
}));

import { getDapodikClient, getDapodikConfig, saveDapodikConfig } from "@/lib/dapodik-sync";
import { DapodikClient } from "@/lib/dapodik-client";

const baseDbConfig = {
  id: "singleton",
  npsn: "40313912",
  token: "token-rahasia-1234",
  host: "localhost",
  port: 5774,
  protocol: "http",
};

describe("getDapodikClient — allowInsecureInProduction diteruskan dari konfigurasi DB", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("production + HTTP + flag true → client berhasil dibuat (tidak diblokir guard HTTPS-only)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      allowInsecureInProduction: true,
    });

    const client = await getDapodikClient();
    expect(client).toBeInstanceOf(DapodikClient);
  });

  it("production + HTTP + flag false (default) → dilempar error guard HTTPS-only", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      allowInsecureInProduction: false,
    });

    await expect(getDapodikClient()).rejects.toThrow(/HTTP tidak diizinkan di production/);
  });

  it("production + HTTPS tetap aman tanpa flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      protocol: "https",
      allowInsecureInProduction: false,
    });

    const client = await getDapodikClient();
    expect(client).toBeInstanceOf(DapodikClient);
  });

  it("dev/test + HTTP tanpa flag → tetap boleh (guard hanya untuk production)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      allowInsecureInProduction: false,
    });

    const client = await getDapodikClient();
    expect(client).toBeInstanceOf(DapodikClient);
  });

  it("konfigurasi belum diatur → error jelas", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue(null);
    await expect(getDapodikClient()).rejects.toThrow(/Konfigurasi Dapodik belum diatur/);
  });
});

describe("saveDapodikConfig — allowInsecureInProduction disimpan ke DB", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("meneruskan flag true ke create & update upsert", async () => {
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
      allowInsecureInProduction: true,
    });

    expect(mockDapodikConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ allowInsecureInProduction: true }),
        update: expect.objectContaining({ allowInsecureInProduction: true }),
      })
    );
  });

  it("flag tidak wajib — simpan tanpa allowInsecureInProduction tetap berjalan", async () => {
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
    });

    expect(mockDapodikConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ allowInsecureInProduction: expect.any(Boolean) }),
      })
    );
  });

  it("token kosong mempertahankan token yang sudah tersimpan", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: "token-lama-9999",
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
    });

    expect(mockDapodikConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ token: "token-lama-9999", host: "10.0.0.5" }),
      })
    );
  });

  it("getDapodikConfig menyembunyikan token dan hash kunci pairing", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      allowInsecureInProduction: false,
      autoSyncEnabled: false,
      autoSyncIntervalHours: 24,
      autoSyncLastRunAt: null,
      autoSyncLastStatus: null,
      autoSyncLastError: null,
      lastSyncAt: null,
      lastSyncBy: null,
      archiveUnlisted: true,
      updatedAt: new Date(),
      bridgeTokenHash: "abc123deadbeef",
      bridgeTokenPrefix: "monsa_br_abcdef",
      bridgeTokenCreatedAt: new Date("2026-09-01T00:00:00Z"),
    });

    const cfg = await getDapodikConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.token).toContain("****");
    expect(cfg?.token).not.toContain("token-rahasia-1234");
    expect(cfg?.hasToken).toBe(true);
    expect(cfg?.hasBridgeToken).toBe(true);
    expect(cfg?.bridgeTokenPrefix).toBe("monsa_br_abcdef");
    expect(JSON.stringify(cfg)).not.toContain("abc123deadbeef");
  });

  it("token wajib pada konfigurasi pertama", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue(null);

    await expect(
      saveDapodikConfig({
        npsn: "40313912",
        token: "",
        host: "localhost",
        port: 5774,
        protocol: "http",
      })
    ).rejects.toThrow(/Token Dapodik wajib/);
  });
});
