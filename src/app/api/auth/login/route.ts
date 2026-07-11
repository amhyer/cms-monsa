import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { verifyPassword, isHashed } from "@/lib/password";
import type { Role } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }
    if (password.length > 1024) {
      return NextResponse.json(
        { error: "Password terlalu panjang." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    // Support both hashed and (legacy) plaintext stored passwords.
    const valid = user
      ? isHashed(user.password)
        ? verifyPassword(password, user.password)
        : user.password === password
      : false;
    // Use constant-time-ish failure regardless of whether user exists.
    if (!user || !valid) {
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

    await setSession(user.id, user.role as Role);

    await logActivity(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as Role,
        isActive: user.isActive,
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
