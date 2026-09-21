/**
 * Helper murni untuk sinkronisasi Dapodik (diekstrak dari dapodik-sync.ts —
 * C2 audit refactor). Semua fungsi di sini bebas side-effect dan bisa diuji
 * terpisah tanpa DB / client Dapodik.
 */
import type { DapodikSiswa } from "./dapodik-sync";

// ---- Helpers ----

export function mapGender(jk?: string): string | null {
  if (!jk) return null;
  const lower = jk.toLowerCase().trim();
  if (lower === "l" || lower.includes("laki")) return "LAKI_LAKI";
  if (lower === "p" || lower.includes("perempuan")) return "PEREMPUAN";
  return null;
}

export function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

// Beberapa nilai dari Dapodik (nisn, nipd) bisa berupa string spasi
// kosong untuk siswa baru yang belum lengkap datanya. String spasi itu
// "truthy" di JS, jadi harus dinormalisasi dulu sebelum dipakai.
export function normalize(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Alamat sekolah dari Dapodik WS: utamakan `alamat_jalan`, fallback `alamat`. */
export function resolveSchoolAddress(sekolah: {
  alamat?: string | null;
  alamat_jalan?: string | null;
}): string | null {
  return normalize(sekolah.alamat_jalan) || normalize(sekolah.alamat);
}

export function combineParentName(ayah?: string, ibu?: string): string | null {
  const parts = [ayah, ibu]
    .map((v) => (v ? v.trim() : ""))
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" / ") : null;
}

// Ekstrak angka kelas dari nama rombel ("1.a" → 1, "III.b" → 3, "VI.a" → 6).
// Dipakai oleh resolveNis untuk membuat fallback NIS numerik.
const ROMBEL_GRADE_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9,
};
export function parseGradeFromRombel(namaRombel?: string): number | null {
  if (!namaRombel) return null;
  const m = namaRombel.match(/^(\d+|[IVX]+)\./i);
  if (!m) return null;
  const token = m[1];
  // Angka Arab: "1.a" → 1
  const asNum = Number(token);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
  // Angka Romawi: "III.b" → 3
  const upper = token.toUpperCase();
  return ROMBEL_GRADE_MAP[upper] ?? null;
}

// nis wajib unik & tidak boleh kosong. Utamakan nipd (NIS lokal); kalau
// tidak ada, generate NIS numerik berbasis kelas/angkatan (bukan UUID)
// supaya sinkronisasi Dapodik berikutnya tidak menimbulkan UUID baru.
//
// Pola fallback: {YY_angkatan}{YY+1}{0715}{hash3} — 10 digit, deterministik
// berdasarkan nama_rombel + nama siswa sehingga konsisten antar sync.
export function resolveNis(
  s: DapodikSiswa,
  namaRombel?: string,
): string {
  const nipd = normalize(s.nipd);
  if (nipd) return nipd;

  // Fallback: NIS numerik berbasis kelas/angkatan
  const grade = parseGradeFromRombel(namaRombel ?? s.nama_rombel);
  const seed = `${s.peserta_didik_id}|${s.nama ?? ""}`;
  if (grade) {
    const now = new Date();
    // Angkatan = tahun saat ini − (kelas − 1)
    // Kelas 1 thn 2026 → angkatan 2026 → 2627
    // Kelas 3 thn 2026 → angkatan 2024 → 2425
    const angkatan = now.getFullYear() - (grade - 1);
    const yy = angkatan % 100;
    const yyNext = (yy + 1) % 100;
    // 4 digit deterministik dari peserta_didik_id + nama (0001–9999)
    // supaya dua siswa senama di kelas yang sama tidak tabrakan.
    const hash = Array.from(seed).reduce(
      (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
      0,
    );
    const seq = (Math.abs(hash) % 9999) + 1;
    return `${String(yy).padStart(2, "0")}${String(yyNext).padStart(2, "0")}07${String(seq).padStart(4, "0")}`;
  }

  // Terakhir: hash deterministik dari id+nama (bukan UUID)
  // Guard: bila nama kosong, pakai peserta_didik_id sebagai fallback mutlak
  if (!s.nama) return s.peserta_didik_id;
  const hash = Array.from(seed).reduce(
    (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
    0,
  );
  return String(Math.abs(hash)).padStart(10, "0").slice(-10);
}
