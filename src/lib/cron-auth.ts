import { timingSafeEqual } from "crypto";

/**
 * Bandingkan header `Authorization: Bearer <token>` dengan secret yang
 * diharapkan, secara timing-safe (temuan review L2).
 *
 * Keempat route `/api/cron/*` sebelumnya memakai `auth !== \`Bearer ${secret}\``,
 * yaitu perbandingan string biasa yang berhenti pada byte pertama yang berbeda.
 * Secara praktis serangan timing atas jaringan sangat sulit, tetapi perbaikan
 * ini murah dan — yang lebih penting — menyamakan pola dengan bagian lain
 * codebase yang sudah memakai `timingSafeEqual` (password, session, CSRF).
 *
 * Catatan: panjang string tetap bocor lewat cabang `length !==`. Itu tidak
 * rahasia (panjang "Bearer " + secret), dan `timingSafeEqual` memang menuntut
 * buffer berukuran sama.
 */
export function bearerMatches(
  authHeader: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!authHeader || !secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf-8");
  const actual = Buffer.from(authHeader, "utf-8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
