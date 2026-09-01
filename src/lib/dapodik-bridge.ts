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

export async function issueBridgeToken(): Promise<{ token: string; prefix: string }> {
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

export async function revokeBridgeToken(): Promise<void> {
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
