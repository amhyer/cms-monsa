/**
 * Regression lock (B2 audit fix): POST /api/auth/2fa/login wajib memasang
 * rate limit ketat SEBELUM memverifikasi kode TOTP — endpoint ini pra-sesi
 * dan tanpa pembatas bisa di-brute-force (kode 6 digit).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const rateLimitPublicForm = vi.hoisted(() =>
  vi.fn<
    (req: unknown, max?: number, windowMs?: number) => Promise<Response | null>
  >(() => Promise.resolve(null))
);

vi.mock("@/lib/rate-limit", () => ({
  rateLimitPublicForm,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/auth/2fa/login/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/auth/2fa/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-real-ip": "1.2.3.4" },
  });
}

describe("POST /api/auth/2fa/login — rate limit wiring", () => {
  beforeEach(() => {
    rateLimitPublicForm.mockClear();
    rateLimitPublicForm.mockImplementation(() => Promise.resolve(null));
  });

  it("memanggil rateLimitPublicForm dengan limit ketat (10/menit)", async () => {
    await POST(makeReq({ userId: "u1", token: "123456" }) as never);
    expect(rateLimitPublicForm).toHaveBeenCalledTimes(1);
    const call = rateLimitPublicForm.mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[1]).toBe(10);
    expect(call?.[2]).toBe(60_000);
  });

  it("mengembalikan 429 dari limiter sebelum menyentuh verifikasi TOTP", async () => {
    rateLimitPublicForm.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Terlalu banyak permintaan." }), {
          status: 429,
        })
      )
    );
    const res = await POST(makeReq({ userId: "u1", token: "000000" }) as never);
    expect(res.status).toBe(429);
  });

  it("saat limiter lolos, request tetap diproses (validasi berjalan)", async () => {
    const res = await POST(makeReq({ userId: "", token: "" }) as never);
    expect(res.status).toBe(400);
  });
});
