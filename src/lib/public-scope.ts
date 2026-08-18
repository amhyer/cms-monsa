/**
 * Kontrak scope publik untuk entitas yang membawa identitas Dapodik
 * (NUPTK/NIP/NIK). Semua kolom model harus diklasifikasikan secara sadar:
 * masuk daftar PUTIH (boleh tampil publik) ATAU daftar OMIT (disaring).
 * Klasifikasi ini dijaga oleh `src/lib/__tests__/public-scope.test.ts`
 * yang membandingkannya dengan prisma/schema.prisma — kolom model baru
 * akan GAGAL test sampai ditambahkan ke salah satu daftar.
 */

/** Kolom identitas sensitif yang tidak boleh keluar dari scope admin. */
export const IDENTITY_FIELDS = ["nuptk", "nip", "nik"] as const;

/** Kolom Teacher yang BOLEH tampil di respons API publik. */
export const PUBLIC_TEACHER_FIELDS = [
  "id",
  "name",
  "position",
  "subject",
  "education",
  "photo",
  "gender",
  "tempatLahir",
  "tanggalLahir",
  "agama",
  "statusKepegawaian",
  "jenisPtk",
  "pangkatGolongan",
  "bidangStudi",
  "phone",
  "email",
  "motto",
  "riwayat",
  "sertifikasi",
  "prestasi",
  "badges",
  "order",
  "isActive",
  "archivedAt",
  "createdAt",
  "updatedAt",
  "homeroomClasses",
] as const;

/** Kolom Teacher yang WAJIB disaring dari respons publik. */
export const PUBLIC_TEACHER_OMIT = [...IDENTITY_FIELDS, "account"] as const;

/** Kolom OrgStructure yang BOLEH tampil di respons API publik. */
export const PUBLIC_ORG_STRUCTURE_FIELDS = [
  "id",
  "name",
  "position",
  "photo",
  "bio",
  "contact",
  "order",
  "isActive",
  "createdAt",
  "updatedAt",
] as const;

/** Kolom OrgStructure yang WAJIB disaring dari respons publik. */
export const PUBLIC_ORG_STRUCTURE_OMIT = IDENTITY_FIELDS;
