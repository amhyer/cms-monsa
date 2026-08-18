/**
 * Filter & penghitung lingkup (kategori / grade) untuk manager dashboard.
 *
 * Pola yang sama dengan user-roles (Manajemen Akun): penghitung "X dari Y"
 * mengikuti tab filter yang aktif — Y (penyebut) = jumlah item pada scope
 * yang aktif, bukan jumlah seluruh item.
 *
 * Logika murni (tanpa React) agar bisa diuji unit langsung.
 */

export type ScopeFilter = string; // "all" | nilai scope spesifik

/**
 * Hitung jumlah item per nilai scope; `all` = total. Opsi yang tidak terpakai
 * tetap dicatat 0 agar tab filter selalu tampil lengkap.
 */
export function computeScopeCounts<T>(
  items: T[],
  key: keyof T,
  options: readonly string[]
): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };
  for (const opt of options) counts[opt] = 0;
  for (const item of items) {
    const v = String(item[key] ?? "");
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

/** Terapkan filter scope; "all" melewati semua item. */
export function applyScopeFilter<T>(
  items: T[],
  key: keyof T,
  active: string
): T[] {
  if (active === "all") return items;
  return items.filter((i) => String(i[key]) === active);
}

/**
 * Teks penghitung: "X dari Y <label>".
 * - X (pembilang) = hasil pencarian + filter scope.
 * - Y (penyebut) = jumlah item pada scope yang aktif (counts[active]) — bukan
 *   items.length — sehingga saat tab scope aktif penyebutnya menyusut.
 *
 * Saat pencarian aktif (searchActive), tambahkan petunjuk terpisah
 * "· N hasil pencarian" agar jelas bahwa X berasal dari pencarian.
 */
export function scopeCounter(
  counts: Record<string, number>,
  active: string,
  visible: unknown[],
  label: string,
  searchActive = false
): string {
  const denominator = counts[active] ?? 0;
  const base = `${visible.length} dari ${denominator} ${label}`;
  return searchActive
    ? `${base} · ${visible.length} hasil pencarian`
    : base;
}
