import { NextResponse } from "next/server";

/**
 * Parse body JSON dari Request dengan aman (C1 audit fix).
 *
 * `await req.json()` polos melempar SyntaxError saat body bukan JSON valid,
 * kosong, atau Content-Type-nya salah — yang sampai ke klien sebagai 500
 * "Terjadi kesalahan server" tanpa petunjuk. Helper ini mengubah kasus itu
 * menjadi 400 eksplisit.
 *
 * Catatan tipe: default generic-nya `any` (bukan `unknown`) dengan sengaja —
 * banyak route lama mengakses field body tanpa cast, dan mengubahnya ke
 * unknown akan memaksa rewrite ratusan baris. Semantik runtime identik dengan
 * `req.json()` lama; kalau suatu saat ingin diperketat, beri cast eksplisit
 * di route terkait (`safeJson<Foo>(req)`).
 *
 * @param req  Request Next.js (route handler)
 * @returns    `{ ok: true, data }` atau `{ ok: false, response }` siap-dikembalikan
 *
 * Contoh pemakaian:
 *   const parsed = await safeJson<Record<string, unknown>>(req);
 *   if (!parsed.ok) return parsed.response;
 *   const body = parsed.data;
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function safeJson<T = any>(
  req: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Body request harus berupa JSON yang valid." },
        { status: 400 }
      ),
    };
  }
}
