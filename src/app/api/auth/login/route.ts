import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { verifyPassword, isHashed } from "@/lib/password";
import {
  isLocked,
  isIpLocked,
  lockSecondsRemaining,
  recordFailure,
  clearFailures,
  getClientIp,
} from "@/lib/rate-limit";
import { loginSchema, validateBody } from "@/lib/validations";
import type { Role } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();
    const ip = getClientIp(req);

    if (password.length > 1024) {
      return NextResponse.json(
        { error: "Password terlalu panjang." },
        { status: 400 }
      );
    }

    // Rate limit: reject if this email+ip is currently locked.
    if (isLocked(normalizedEmail, ip)) {
      const secs = lockSecondsRemaining(normalizedEmail, ip);
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(
            secs / 60
          )} menit.`,
        },
        { status: 429 }
      );
    }

    // IP-level rate limit: prevent credential stuffing attacks across multiple accounts
    if (isIpLocked(ip)) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan dari alamat ini. Coba lagi dalam 15 menit.`,
        },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    // Support both hashed and (legacy) plaintext stored passwords.
    const valid = user
      ? isHashed(user.password)
        ? verifyPassword(password, user.password)
        : user.password === password
      : false;
    // Use constant-time-ish failure regardless of whether user exists.
    if (!user || !valid) {
      recordFailure(normalizedEmail, ip);
      return NextResponse.json(
        { error: "Email atau password salah." },
        { status: 401 }
      );
    }
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Akun Anda dinonaktifkan. Hubungi administrator." },
        { status: 403 }
      );
    }

    // Success — clear any prior failure counter.
    clearFailures(normalizedEmail, ip);

    await setSession(user.id, user.role as Role);

    await logActivity(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as Role,
        isActive: user.isActive,
        guardianClassId: user.guardianClassId ?? null,
      },
      "LOGIN",
      "Auth",
      "Login ke sistem"
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
