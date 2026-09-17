import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";

// Mock db minimal — saveDapodikConfig & getDapodikClient hanya menyentuh
// dapodikConfig. vi.hoisted agar mock tersedia sebelum modul di-import.
const { mockDapodikConfig } = vi.hoisted(() => ({
  mockDapodikConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { dapodikConfig: mockDapodikConfig },
}));

import { saveDapodikConfig, getDapodikClient } from "@/lib/dapodik-sync";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";

/**
 * Suite ini menguji PATH TERENKRIPSI token Dapodik secara hermetik:
 * key selalu di-generate fresh per test (tidak bergantung env host) sehingga
 * lulus di mana pun — termasuk mesin yang .env.local-nya punya
 * DAPODIK_ENCRYPTION_KEY (penyebab test dapodik-config pernah flaky).
 *
 * Skenario kunci:
 *  - plaintext dari form  → dienkripsi sebelum masuk DB
 *  - ciphertext fallback   → TIDAK dienkripsi ulang (regresi double-encrypt)
 *  - plaintext legacy      → dienkripsi (migrasi data lama)
 *  - tanpa key             → disimpan apa adanya (perilaku lama)
 *  - round-trip simpan→muat: getDapodikClient mendekripsi tepat satu kali
 */
describe("saveDapodikConfig — enkripsi token (path terenkripsi)", () => {
  beforeEach(() => {
    vi.stubEnv("DAPODIK_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("token plaintext dari form dienkripsi sebelum disimpan", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue(null);
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { token: string };
    };
    expect(isEncrypted(saved.update.token)).toBe(true);
    // Dekripsi SEKALI harus langsung menghasilkan plaintext asli —
    // bukti tidak ada enkripsi ganda.
    expect(decrypt(saved.update.token)).toBe("token-rahasia-1234");
  });

  it("token kosong + fallback ciphertext tersimpan → TIDAK dienkripsi ulang", async () => {
    // Skenario regresi double-encrypt: form selalu mengirim token: "" saat
    // token tidak diubah; rawToken jatuh ke nilai DB yang sudah ciphertext.
    const storedCipher = encrypt("token-lama-9999");
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: storedCipher,
      host: "localhost",
      port: 5774,
      protocol: "http",
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { token: string };
    };
    expect(saved.update.token).toBe(storedCipher);
    expect(decrypt(saved.update.token)).toBe("token-lama-9999");
  });

  it("token kosong + fallback plaintext legacy → dienkripsi (migrasi data lama)", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: "token-lama-9999", // 15 byte < 33 → dianggap belum terenkripsi
      host: "localhost",
      port: 5774,
      protocol: "http",
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { token: string };
    };
    expect(saved.update.token).not.toBe("token-lama-9999");
    expect(decrypt(saved.update.token)).toBe("token-lama-9999");
  });

  it("tanpa DAPODIK_ENCRYPTION_KEY → token disimpan plaintext apa adanya", async () => {
    vi.stubEnv("DAPODIK_ENCRYPTION_KEY", "");
    mockDapodikConfig.findUnique.mockResolvedValue(null);
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { token: string };
    };
    expect(saved.update.token).toBe("token-rahasia-1234");
  });

  it("cfAccessClientSecret ikut terenkripsi, cfAccessClientId diteruskan", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue(null);
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
      cfAccessClientId: "client.access.example",
      cfAccessClientSecret: "rahasia-cf-456",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { cfAccessClientSecret: string; cfAccessClientId: string };
    };
    expect(saved.update.cfAccessClientId).toBe("client.access.example");
    expect(saved.update.cfAccessClientSecret).not.toBe("rahasia-cf-456");
    expect(decrypt(saved.update.cfAccessClientSecret)).toBe("rahasia-cf-456");
  });

  it("secret tidak dikirim + fallback ciphertext tersimpan → dipertahankan, TIDAK dienkripsi ulang", async () => {
    // Regresi wipe + double-encrypt: UI form tidak punya field CF Access,
    // route mengirim cfAccessClientSecret: null. Nilai DB harus dipertahankan
    // apa adanya — bukan ditimpa null dan bukan dienkripsi ulang.
    const storedCipher = encrypt("rahasia-cf-456");
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: "token-tersimpan",
      host: "localhost",
      port: 5774,
      protocol: "http",
      cfAccessClientId: "client.access.example",
      cfAccessClientSecret: storedCipher,
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "", // UI selalu kirim token kosong saat tidak diubah
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { cfAccessClientSecret: string | null; cfAccessClientId: string | null };
    };
    expect(saved.update.cfAccessClientSecret).toBe(storedCipher);
    expect(decrypt(saved.update.cfAccessClientSecret!)).toBe("rahasia-cf-456");
    // Client ID juga tidak ikut ter-wipe.
    expect(saved.update.cfAccessClientId).toBe("client.access.example");
  });

  it("secret tidak dikirim + plaintext legacy tersimpan → dienkripsi (migrasi data lama)", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: "token-tersimpan",
      host: "localhost",
      port: 5774,
      protocol: "http",
      cfAccessClientSecret: "rahasia-cf-456", // < 33 byte → belum terenkripsi
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { cfAccessClientSecret: string };
    };
    expect(saved.update.cfAccessClientSecret).not.toBe("rahasia-cf-456");
    expect(decrypt(saved.update.cfAccessClientSecret)).toBe("rahasia-cf-456");
  });

  it("secret baru dari form menggantikan secret lama (rotasi) tanpa double-encrypt", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: "token-tersimpan",
      host: "localhost",
      port: 5774,
      protocol: "http",
      cfAccessClientSecret: encrypt("rahasia-cf-lama"),
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
      cfAccessClientId: "client.baru.access",
      cfAccessClientSecret: "rahasia-cf-baru",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { cfAccessClientSecret: string; cfAccessClientId: string };
    };
    expect(decrypt(saved.update.cfAccessClientSecret)).toBe("rahasia-cf-baru");
    expect(saved.update.cfAccessClientId).toBe("client.baru.access");
  });

  it("cfAccessClientId dikirim kosong → dihapus (bukan fallback); secret tetap dipertahankan", async () => {
    const storedCipher = encrypt("rahasia-cf-456");
    mockDapodikConfig.findUnique.mockResolvedValue({
      id: "singleton",
      npsn: "40313912",
      token: "token-tersimpan",
      host: "localhost",
      port: 5774,
      protocol: "http",
      cfAccessClientId: "client.access.example",
      cfAccessClientSecret: storedCipher,
    });
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "",
      host: "10.0.0.5",
      port: 5774,
      protocol: "http",
      cfAccessClientId: "", // field DIKIRIM kosong → hapus, bukan pertahankan
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      update: { cfAccessClientSecret: string | null; cfAccessClientId: string | null };
    };
    expect(saved.update.cfAccessClientId).toBeNull();
    // Secret tidak terpengaruh oleh penghapusan Client ID.
    expect(saved.update.cfAccessClientSecret).toBe(storedCipher);
  });

  it("tanpa secret lama & tanpa secret baru → tetap null (bukan string kosong)", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue(null);
    mockDapodikConfig.upsert.mockResolvedValue({ id: "singleton" });

    await saveDapodikConfig({
      npsn: "40313912",
      token: "token-rahasia-1234",
      host: "localhost",
      port: 5774,
      protocol: "http",
    });

    const saved = mockDapodikConfig.upsert.mock.calls[0][0] as {
      create: { cfAccessClientSecret: string | null };
    };
    expect(saved.create.cfAccessClientSecret).toBeNull();
  });
});

describe("getDapodikClient — dekripsi token tersimpan (round-trip)", () => {
  beforeEach(() => {
    vi.stubEnv("DAPODIK_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    // Guard HTTPS-only hanya berlaku di production; kunci ke node test.
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const baseDbConfig = {
    id: "singleton",
    npsn: "40313912",
    host: "localhost",
    port: 5774,
    protocol: "http",
  };

  it("round-trip: token tersimpan ciphertext → client memakai plaintext hasil dekripsi sekali", async () => {
    const cipher = encrypt("token-rahasia-1234");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: cipher,
    });

    const client = await getDapodikClient();
    // Token private — dibaca via cast untuk verifikasi perilaku internal.
    const token = (client as unknown as { token: string }).token;
    expect(token).toBe("token-rahasia-1234");
  });

  it("token legacy plaintext + key aktif → dienkripsi ulang ke DB dan tetap terpakai", async () => {
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: "token-lama-9999",
    });
    mockDapodikConfig.update.mockResolvedValue({ id: "singleton" });

    const client = await getDapodikClient();
    expect((client as unknown as { token: string }).token).toBe("token-lama-9999");

    expect(mockDapodikConfig.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockDapodikConfig.update.mock.calls[0][0] as {
      data: { token: string };
    };
    expect(updateArgs.data.token).not.toBe("token-lama-9999");
    expect(decrypt(updateArgs.data.token)).toBe("token-lama-9999");
  });

  it("ciphertext dengan key lain/salah → fallback tanpa crash, token tidak diubah", async () => {
    // Enkripsi dengan key A, lalu ganti ke key B → decrypt gagal (auth tag).
    vi.stubEnv("DAPODIK_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    const cipherWithOtherKey = encrypt("token-rahasia-1234");
    vi.stubEnv("DAPODIK_ENCRYPTION_KEY", randomBytes(32).toString("hex"));

    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: cipherWithOtherKey,
    });

    const client = await getDapodikClient();
    expect((client as unknown as { token: string }).token).toBe(
      cipherWithOtherKey
    );
    // Gagal dekripsi tidak boleh memicu penulisan ulang ke DB.
    expect(mockDapodikConfig.update).not.toHaveBeenCalled();
  });

  it("round-trip secret CF Access: ciphertext → client memakai plaintext hasil dekripsi sekali", async () => {
    const cipher = encrypt("rahasia-cf-456");
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: "token-rahasia-1234",
      cfAccessClientId: "client.access.example",
      cfAccessClientSecret: cipher,
    });

    const client = await getDapodikClient();
    const secret = (client as unknown as { cfAccessClientSecret?: string })
      .cfAccessClientSecret;
    // Dekripsi tepat satu kali → plaintext asli (bukan ciphertext sisa
    // double-decrypt yang gagal, bukan error fallback).
    expect(secret).toBe("rahasia-cf-456");
    expect(secret).not.toBe(cipher);
  });

  it("secret legacy plaintext + key aktif → self-heal terenkripsi ke DB, client tetap dapat plaintext", async () => {
    // Token sudah ciphertext → tidak ada self-heal token; satu-satunya
    // update yang diharapkan adalah self-heal secret.
    mockDapodikConfig.findUnique.mockResolvedValue({
      ...baseDbConfig,
      token: encrypt("token-rahasia-1234"),
      cfAccessClientSecret: "rahasia-cf-456",
    });
    mockDapodikConfig.update.mockResolvedValue({ id: "singleton" });

    const client = await getDapodikClient();
    const secret = (client as unknown as { cfAccessClientSecret?: string })
      .cfAccessClientSecret;
    expect(secret).toBe("rahasia-cf-456");

    expect(mockDapodikConfig.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockDapodikConfig.update.mock.calls[0][0] as {
      data: { cfAccessClientSecret: string };
    };
    expect(decrypt(updateArgs.data.cfAccessClientSecret)).toBe("rahasia-cf-456");
  });
});
