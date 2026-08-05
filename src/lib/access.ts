/**
 * Access-control path guards for the dashboard.
 *
 * Pure functions (no React/Next dependencies) so they can be unit-tested
 * without a DOM or request context.
 */

/**
 * GURU hanya boleh mengakses Ringkasan + Kehadiran (kelas wali-nya).
 *
 * `/dashboard` harus exact-match (bukan prefix) — jika prefix-match,
 * `/dashboard/news` dll. ikut lolos (`"/dashboard/news".startsWith("/dashboard/")`
 * bernilai true) sehingga GURU bisa membuka seluruh modul dashboard.
 * Hanya `/dashboard/attendance/...` yang sengaja diizinkan prefix-match
 * untuk mengakomodasi sub-halaman kehadiran (future-proof).
 */
export function isGuruDeniedPath(pathname: string): boolean {
  return !(
    pathname === "/dashboard" ||
    pathname === "/dashboard/attendance" ||
    pathname.startsWith("/dashboard/attendance/")
  );
}
