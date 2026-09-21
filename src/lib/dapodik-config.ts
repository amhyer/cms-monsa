/**
 * Konfigurasi Dapodik: baca/tulis DB, dekripsi kredensial, dan test koneksi
 * (diekstrak dari dapodik-sync.ts — C2 audit refactor). Re-export tetap
 * tersedia dari dapodik-sync.ts agar import lama tidak rusak.
 */
import { db } from "@/lib/db";
import { DapodikClient, type DapodikConfig as DapodikClientConfig } from "@/lib/dapodik-client";
import { ensureBridgeColumns } from "@/lib/dapodik-bridge";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { normalize } from "./dapodik-sync-helpers";

// ---- Get Dapodik Client from DB config ----

export async function getDapodikClient(): Promise<DapodikClient> {
  const config = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    throw new Error("Konfigurasi Dapodik belum diatur. Silakan simpan konfigurasi terlebih dahulu.");
  }

  // Dekripsi token — support backward compatibility (data lama belum terenkripsi)
  let token = config.token;
  try {
    if (isEncrypted(token)) {
      token = decrypt(token);
    } else if (process.env.DAPODIK_ENCRYPTION_KEY) {
      // Data lama belum terenkripsi tapi key sudah ada → enkripsi ulang
      logger.info("[dapodik] Mengenkripsi token lama yang belum terenkripsi");
      await db.dapodikConfig.update({
        where: { id: "singleton" },
        data: { token: encrypt(token) },
      });
    }
  } catch (err) {
    logger.error({ err }, "[dapodik] Gagal dekripsi token");
    // Lanjut dengan token asli — mungkin memang belum terenkripsi
  }

  // Dekripsi CF Access Client Secret (jika ada)
  let cfAccessClientSecret = config.cfAccessClientSecret ?? undefined;
  if (cfAccessClientSecret) {
    try {
      if (isEncrypted(cfAccessClientSecret)) {
        cfAccessClientSecret = decrypt(cfAccessClientSecret);
      } else if (process.env.DAPODIK_ENCRYPTION_KEY) {
        const encrypted = encrypt(cfAccessClientSecret);
        await db.dapodikConfig.update({
          where: { id: "singleton" },
          data: { cfAccessClientSecret: encrypted },
        });
        cfAccessClientSecret = decrypt(encrypted);
      }
    } catch (err) {
      logger.error({ err }, "[dapodik] Gagal dekripsi cfAccessClientSecret");
    }
  }

  const clientConfig: DapodikClientConfig = {
    npsn: config.npsn,
    token,
    host: config.host,
    port: config.port,
    protocol: config.protocol as "http" | "https",
    allowInsecureInProduction: config.allowInsecureInProduction,
    cfAccessClientId: config.cfAccessClientId ?? undefined,
    cfAccessClientSecret,
  };
  return new DapodikClient(clientConfig);
}

// ---- Save Config ----

export async function saveDapodikConfig(data: {
  npsn: string;
  token?: string;
  host: string;
  port: number;
  protocol: string;
  archiveUnlisted?: boolean;
  allowInsecureInProduction?: boolean;
  cfAccessClientId?: string | null;
  cfAccessClientSecret?: string | null;
}) {
  const existing = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  // Token dari form selalu plaintext; fallback existing bisa berupa ciphertext
  // (sudah terenkripsi saat disimpan sebelumnya).
  const tokenFromRequest = normalize(data.token);
  const rawToken = tokenFromRequest || existing?.token || null;
  if (!rawToken) {
    throw new Error("Token Dapodik wajib diisi pada konfigurasi pertama.");
  }

  // Enkripsi token & cfAccessClientSecret sebelum simpan ke DB.
  // Hanya enkripsi saat input memang plaintext yang belum terenkripsi: token
  // yang diambil dari existing dan sudah berformat ciphertext TIDAK boleh
  // dienkripsi ulang — double encryption membuat dekripsi sekali di
  // getDapodikClient menghasilkan ciphertext (bukan plaintext), sehingga
  // Web Service Dapodik gagal auth.
  const encryptionKey = process.env.DAPODIK_ENCRYPTION_KEY;
  const tokenToSave =
    encryptionKey && (tokenFromRequest || !isEncrypted(rawToken))
      ? encrypt(rawToken)
      : rawToken;
  // CF Access — perilaku sama dengan token: secret dari form selalu
  // plaintext, fallback existing bisa berupa ciphertext. Bila request tidak
  // mengirim secret (UI form tidak punya field CF Access → route mengirim
  // null), pertahankan nilai DB agar secret tidak ter-wipe setiap kali
  // konfigurasi disimpan. Guard isEncrypted mencegah enkripsi ganda pada
  // ciphertext fallback. cfAccessClientId ikut dipertahankan agar pasangan
  // CF Access tetap konsisten.
  const cfSecretFromRequest = normalize(data.cfAccessClientSecret);
  const rawCfSecret = cfSecretFromRequest || existing?.cfAccessClientSecret || null;
  const cfSecretToSave =
    rawCfSecret && encryptionKey && (cfSecretFromRequest || !isEncrypted(rawCfSecret))
      ? encrypt(rawCfSecret)
      : rawCfSecret;
  // Client ID: field yang DIKIRKan (termasuk string kosong) berarti set/hapus;
  // yang tidak dikirim sama sekali (undefined) berarti pertahankan nilai DB.
  const cfClientIdToSave =
    data.cfAccessClientId !== undefined
      ? normalize(data.cfAccessClientId)
      : existing?.cfAccessClientId ?? null;

  return db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      npsn: data.npsn,
      token: tokenToSave,
      host: data.host,
      port: data.port,
      protocol: data.protocol,
      ...(typeof data.archiveUnlisted === "boolean" ? { archiveUnlisted: data.archiveUnlisted } : {}),
      ...(typeof data.allowInsecureInProduction === "boolean"
        ? { allowInsecureInProduction: data.allowInsecureInProduction }
        : {}),
      cfAccessClientId: cfClientIdToSave,
      cfAccessClientSecret: cfSecretToSave,
    },
    update: {
      npsn: data.npsn,
      token: tokenToSave,
      host: data.host,
      port: data.port,
      protocol: data.protocol,
      ...(typeof data.archiveUnlisted === "boolean" ? { archiveUnlisted: data.archiveUnlisted } : {}),
      ...(typeof data.allowInsecureInProduction === "boolean"
        ? { allowInsecureInProduction: data.allowInsecureInProduction }
        : {}),
      cfAccessClientId: cfClientIdToSave,
      cfAccessClientSecret: cfSecretToSave,
    },
  });
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * Baca DapodikConfig dengan self-heal untuk kolom kunci pairing.
 * Bila migrasi Neon belum jalan, field bridgeTokenHash/bridgeTokenPrefix/
 * bridgeTokenCreatedAt belum ada di tabel → Prisma melempar P2022. Runtime
 * menambahkan kolom lewat ensureBridgeColumns lalu mengulang baca sekali,
 * agar dashboard tidak error saat kolom belum dimigrasi.
 */
async function readConfigWithBridgeHeal() {
  try {
    return await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2022") throw err;
    await ensureBridgeColumns();
    return await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  }
}

export async function getDapodikConfig() {
  const config = await readConfigWithBridgeHeal();
  if (!config) return null;
  const token = config.token ?? "";
  return {
    id: config.id,
    npsn: config.npsn,
    host: config.host,
    port: config.port,
    protocol: config.protocol,
    allowInsecureInProduction: config.allowInsecureInProduction,
    autoSyncEnabled: config.autoSyncEnabled,
    autoSyncIntervalHours: config.autoSyncIntervalHours,
    autoSyncLastRunAt: config.autoSyncLastRunAt,
    autoSyncLastStatus: config.autoSyncLastStatus,
    autoSyncLastError: config.autoSyncLastError,
    lastSyncAt: config.lastSyncAt,
    lastSyncBy: config.lastSyncBy,
    archiveUnlisted: config.archiveUnlisted,
    updatedAt: config.updatedAt,
    token: maskSecret(token),
    hasToken: token.length > 0,
    hasBridgeToken: Boolean(config.bridgeTokenHash),
    bridgeTokenPrefix: config.bridgeTokenPrefix ?? null,
    bridgeTokenCreatedAt: config.bridgeTokenCreatedAt ?? null,
    // CF Access — Client ID tampil penuh, Secret di-mask
    cfAccessClientId: config.cfAccessClientId ?? null,
    cfAccessClientSecret: config.cfAccessClientSecret
      ? maskSecret(config.cfAccessClientSecret)
      : null,
  };
}

// ---- Test Connection ----

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const client = await getDapodikClient();
    const sekolah = await client.getSekolah();
    return {
      success: true,
      message: `Tersambung ke Dapodik — ${sekolah.nama} (NPSN: ${sekolah.npsn})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal menghubungi Dapodik";
    return { success: false, message: msg };
  }
}
