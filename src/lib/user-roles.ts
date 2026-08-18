/**
 * Filter & penghitung peran akun untuk Manajemen Akun (users-manager).
 *
 * Logika murni (tanpa React) agar bisa diuji unit langsung — khususnya
 * perilaku penghitung "X dari Y akun": Y (penyebut) harus mengikuti tab
 * peran yang aktif, bukan jumlah seluruh akun.
 */

export type RoleFilter = "all" | "STAFF" | "GURU" | "ORANG_TUA" | "SISWA";

export type RoleCounts = Record<RoleFilter, number>;

/** Hitung jumlah akun per peran; STAFF = SUPER_ADMIN + OPERATOR. */
export function computeRoleCounts(items: { role: string }[]): RoleCounts {
  const c: RoleCounts = {
    all: items.length,
    STAFF: 0,
    GURU: 0,
    ORANG_TUA: 0,
    SISWA: 0,
  };
  for (const u of items) {
    if (u.role === "SUPER_ADMIN" || u.role === "OPERATOR") c.STAFF++;
    else if (u.role === "GURU") c.GURU++;
    else if (u.role === "ORANG_TUA") c.ORANG_TUA++;
    else if (u.role === "SISWA") c.SISWA++;
  }
  return c;
}

/** Terapkan filter peran ke daftar (biasanya daftar yang sudah ter-filter pencarian). */
export function applyRoleFilter<T extends { role: string }>(
  items: T[],
  roleFilter: RoleFilter
): T[] {
  if (roleFilter === "all") return items;
  if (roleFilter === "STAFF")
    return items.filter(
      (u) => u.role === "SUPER_ADMIN" || u.role === "OPERATOR"
    );
  return items.filter((u) => u.role === roleFilter);
}

/**
 * Teks penghitung akun: "X dari Y akun".
 * - X (pembilang) = jumlah akun hasil filter peran + pencarian (dari server).
 * - Y (penyebut) = total akun peran yang aktif (counts[roleFilter]) — bukan
 *   total seluruh akun — sehingga saat tab peran aktif penyebutnya menyusut.
 *
 * Saat pencarian aktif (searchActive), tambahkan petunjuk terpisah
 * "· N hasil pencarian" agar jelas bahwa X berasal dari pencarian.
 */
export function accountCounter(
  filteredTotal: number,
  roleTotal: number,
  searchActive = false
): string {
  const base = `${filteredTotal} dari ${roleTotal} akun`;
  return searchActive ? `${base} · ${filteredTotal} hasil pencarian` : base;
}

/**
 * Migrasi tautan saat role akun diganti di dialog edit — meniru perilaku PUT
 * /api/users/[id]:
 * - guardianClassId hanya berlaku untuk GURU; role lain SELALU dikosongkan
 *   (route: `else data.guardianClassId = null`).
 * - studentId hanya untuk SISWA, guardianStudentId hanya untuk ORANG_TUA;
 *   tautan untuk role lain dikosongkan (route: `else data.studentId = null`,
 *   `else data.guardianStudentId = null`).
 * - ORANG_TUA ↔ SISWA tetap MEMBAWA tautan siswa yang sudah ada agar tidak
 *   hilang diam-diam saat role berpindah (guardianStudentId → studentId atau
 *   sebaliknya), selama field tujuan belum terisi.
 *
 * Mengembalikan field yang berubah, atau null bila tidak ada yang berubah
 * (mis. memilih role yang sama).
 */
export function carryStudentLink(
  nextRole: "GURU" | "ORANG_TUA" | "SISWA" | "OPERATOR" | "SUPER_ADMIN",
  form: {
    guardianStudentId: string;
    studentId: string;
    guardianClassId: string;
  }
): {
  guardianStudentId: string;
  studentId: string;
  guardianClassId: string;
} | null {
  const next = {
    guardianStudentId: form.guardianStudentId,
    studentId: form.studentId,
    guardianClassId: form.guardianClassId,
  };

  // Wali kelas hanya untuk GURU — selain itu selalu dikosongkan.
  if (nextRole !== "GURU") next.guardianClassId = "";

  if (nextRole === "SISWA") {
    if (!next.studentId && form.guardianStudentId) {
      // Bawa tautan dari ORANG_TUA agar tidak hilang diam-diam.
      next.studentId = form.guardianStudentId;
      next.guardianStudentId = "";
    } else {
      next.guardianStudentId = "";
    }
  } else if (nextRole === "ORANG_TUA") {
    if (!next.guardianStudentId && form.studentId) {
      // Bawa tautan dari SISWA agar tidak hilang diam-diam.
      next.guardianStudentId = form.studentId;
      next.studentId = "";
    } else {
      next.studentId = "";
    }
  } else {
    next.studentId = "";
    next.guardianStudentId = "";
  }

  if (
    next.guardianStudentId === form.guardianStudentId &&
    next.studentId === form.studentId &&
    next.guardianClassId === form.guardianClassId
  ) {
    return null;
  }
  return next;
}
