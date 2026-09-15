/**
 * Access-control path guards for the dashboard.
 *
 * Pure functions (no React/Next dependencies) so they can be unit-tested
 * without a DOM or request context.
 */

/**
* GURU hanya boleh mengakses Ringkasan + Kehadiran (kelas wali-nya)
 * + Profil Saya (mengelola data pribadi yang tampil di website)
 * + Jadwal Pelajaran + Ganti Password Sendiri.
 *
 * `/dashboard` harus exact-match (bukan prefix) — jika prefix-match,
 * `/dashboard/news` dll. ikut lolos (`"/dashboard/news".startsWith("/dashboard/")`
 * bernilai true) sehingga GURU bisa membuka seluruh modul dashboard.
 * Hanya `/dashboard/attendance/...` yang sengaja diizinkan prefix-match
 * untuk mengakomodasi sub-halaman kehadiran (future-proof).
 *
 * `/dashboard/change-password` WAJIB diizinkan: layout memaksa redirect ke
 * sana saat `mustChangePassword` — tanpanya akun Guru yang wajib ganti
 * password terkunci total (redirect → ditolak → redirect …).
 */
export function isGuruDeniedPath(pathname: string): boolean {
  return !(
    pathname === "/dashboard" ||
    pathname === "/dashboard/attendance" ||
    pathname.startsWith("/dashboard/attendance/") ||
    pathname === "/dashboard/profile" ||
    pathname === "/dashboard/schedule" ||
    pathname === "/dashboard/change-password"
  );
}
