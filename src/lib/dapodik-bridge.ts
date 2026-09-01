import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

const TOKEN_PREFIX = "monsa_br_";
const TOKEN_BYTES = 24;
const DISPLAY_PREFIX_LEN = 16;

export function hashBridgeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateBridgeToken(): {
  token: string;
  hash: string;
  prefix: string;
} {
  const token = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("hex");
  return {
    token,
    hash: hashBridgeToken(token),
    prefix: token.slice(0, DISPLAY_PREFIX_LEN),
  };
}

export function verifyBridgeToken(plain: string, hash: string): boolean {
  if (!plain || !hash) return false;
  const got = hashBridgeToken(plain);
  if (got.length !== hash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(hash, "utf8"));
  } catch {
    return false;
  }
}

export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)/i.exec(header.trim());
  return m?.[1] ?? null;
}

export function extractBridgeToken(req: {
  headers: Headers;
}): string | null {
  const fromAuth = parseBearerToken(req.headers.get("authorization"));
  if (fromAuth) return fromAuth;
  const alt = req.headers.get("x-bridge-token");
  if (!alt) return null;
  const trimmed = alt.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Self-heal: pastikan kolom kunci pairing ada di tabel DapodikConfig.
 * Kolom ini ditambahkan migrasi prisma/migrations/…_add_dapodik_bridge_token,
 * tapi bila migrasi Neon belum dijalankan (Deploy database gagal), runtime
 * akan menambahkan kolom di sini agar tombol "Buat kunci pairing" tetap hidup.
 * Idempotent (IF NOT EXISTS) — aman dipanggil berkali-kali.
 */
const BRIDGE_COLUMN_DDL = [
  '"bridgeTokenHash" TEXT',
  '"bridgeTokenPrefix" TEXT',
  '"bridgeTokenCreatedAt" TIMESTAMP(3)',
];

export async function ensureBridgeColumns(): Promise<void> {
  // Sekali ALTER untuk semua kolom; fallback per-kolom bila multi-ADD gagal.
  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS ${BRIDGE_COLUMN_DDL.join(", ADD COLUMN IF NOT EXISTS ")}`
    );
    return;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2022") throw err;
  }
  for (const col of BRIDGE_COLUMN_DDL) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "DapodikConfig" ADD COLUMN IF NOT EXISTS ${col}`);
    } catch {
      // abaikan — kolom kemungkinan sudah ada
    }
  }
}

function isColumnMissing(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2022";
}

async function issueBridgeTokenInner(): Promise<{ token: string; prefix: string }> {
  const { token, hash, prefix } = generateBridgeToken();
  const existing = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  await db.dapodikConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      npsn: existing?.npsn || "",
      token: existing?.token || "",
      bridgeTokenHash: hash,
      bridgeTokenPrefix: prefix,
      bridgeTokenCreatedAt: new Date(),
    },
    update: {
      bridgeTokenHash: hash,
      bridgeTokenPrefix: prefix,
      bridgeTokenCreatedAt: new Date(),
    },
  });
  return { token, prefix };
}

export async function issueBridgeToken(): Promise<{ token: string; prefix: string }> {
  try {
    return await issueBridgeTokenInner();
  } catch (err) {
    if (!isColumnMissing(err)) throw err;
    // Migrasi belum jalan — tambah kolom lalu ulangi sekali.
    await ensureBridgeColumns();
    return await issueBridgeTokenInner();
  }
}

async function revokeBridgeTokenInner(): Promise<void> {
  const existing = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!existing) return;
  await db.dapodikConfig.update({
    where: { id: "singleton" },
    data: {
      bridgeTokenHash: null,
      bridgeTokenPrefix: null,
      bridgeTokenCreatedAt: null,
    },
  });
}

export async function revokeBridgeToken(): Promise<void> {
  try {
    return await revokeBridgeTokenInner();
  } catch (err) {
    if (!isColumnMissing(err)) throw err;
    await ensureBridgeColumns();
    return await revokeBridgeTokenInner();
  }
}

export async function authenticateBridgeRequest(req: {
  headers: Headers;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = extractBridgeToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Kunci pairing wajib (Authorization: Bearer …).",
    };
  }
  const cfg = await db.dapodikConfig.findUnique({ where: { id: "singleton" } });
  if (!cfg?.bridgeTokenHash) {
    return {
      ok: false,
      status: 401,
      error: "Kunci pairing belum dibuat di dashboard CMS.",
    };
  }
  if (!verifyBridgeToken(token, cfg.bridgeTokenHash)) {
    return { ok: false, status: 401, error: "Kunci pairing tidak valid." };
  }
  return { ok: true };
}
