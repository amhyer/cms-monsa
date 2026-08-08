import { z } from "zod";

// --- News ---
export const newsCategoryEnum = z.enum(["Akademik", "Kegiatan", "Prestasi"]);
export const newsStatusEnum = z.enum(["DRAFT", "PUBLISHED"]);

export const createNewsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  content: z
    .string()
    .max(50000, "Konten terlalu panjang (maksimal 50.000 karakter)."),
  excerpt: z.string().max(500, "Excerpt maksimal 500 karakter.").optional(),
  coverImage: z.string().url("URL gambar tidak valid.").optional().nullable(),
  category: newsCategoryEnum.default("Kegiatan"),
  status: newsStatusEnum.default("DRAFT"),
});

export const updateNewsSchema = createNewsSchema.partial();

// --- Announcements ---
// Catatan: model Announcement hanya memiliki isPinned/expiresAt/isActive —
// tidak ada kolom `priority` maupun `status`, jadi schema tidak memvalidasinya.
export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  content: z
    .string()
    .max(20000, "Konten terlalu panjang (maksimal 20.000 karakter)."),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// --- Gallery ---
export const createGallerySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  description: z
    .string()
    .max(2000, "Deskripsi maksimal 2.000 karakter.")
    .optional(),
  imageUrl: z.string().url("URL gambar tidak valid.").optional(),
  url: z.string().url("URL media tidak valid.").optional(),
  category: z.string().max(100).optional(),
});

export const updateGallerySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter.")
    .optional(),
  description: z
    .string()
    .max(2000, "Deskripsi maksimal 2.000 karakter.")
    .optional(),
  imageUrl: z.string().url("URL gambar tidak valid.").optional(),
  url: z.string().url("URL media tidak valid.").optional(),
  category: z.string().max(100).optional(),
});

// --- Teachers ---
export const createTeacherSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  subject: z
    .string()
    .trim()
    .max(100, "Mata pelajaran maksimal 100 karakter.")
    .optional(),
  bio: z.string().max(2000, "Bio maksimal 2.000 karakter.").optional(),
  imageUrl: z.string().url("URL gambar tidak valid.").optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export const updateTeacherSchema = createTeacherSchema.partial();

// --- Users ---
export const userRoleEnum = z.enum(["SUPER_ADMIN", "OPERATOR", "GURU", "ORANG_TUA"]);

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  email: z
    .string()
    .email("Format email tidak valid.")
    .max(200, "Email maksimal 200 karakter."),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter.")
    .max(100, "Password maksimal 100 karakter."),
  role: userRoleEnum.default("OPERATOR"),
  guardianClassId: z.string().nullable().optional(),
  guardianStudentId: z.string().nullable().optional(),
});

export const updateUserSchema = createUserSchema
  .partial()
  .extend({ password: z.string().min(6).max(100).optional() });

// --- Contact ---
export const createContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  email: z.string().email("Format email tidak valid.").max(200),
  subject: z
    .string()
    .trim()
    .min(1, "Subjek wajib diisi.")
    .max(200, "Subjek maksimal 200 karakter."),
  message: z
    .string()
    .trim()
    .min(1, "Pesan wajib diisi.")
    .max(5000, "Pesan maksimal 5.000 karakter."),
});

// --- Complaints ---
export const createComplaintSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  email: z.string().email("Format email tidak valid.").max(200),
  subject: z
    .string()
    .trim()
    .min(1, "Subjek wajib diisi.")
    .max(200, "Subjek maksimal 200 karakter."),
  message: z
    .string()
    .trim()
    .min(1, "Pesan wajib diisi.")
    .max(5000, "Pesan maksimal 5.000 karakter."),
  category: z
    .string()
    .max(100, "Kategori maksimal 100 karakter.")
    .optional(),
});

// --- Agenda ---
export const agendaStatusEnum = z.enum(["UPCOMING", "ONGOING", "COMPLETED"]);

export const createAgendaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  description: z
    .string()
    .max(5000, "Deskripsi maksimal 5.000 karakter.")
    .optional(),
  date: z.string().min(1, "Tanggal wajib diisi."),
  time: z.string().max(50, "Waktu maksimal 50 karakter.").optional(),
  location: z
    .string()
    .max(200, "Lokasi maksimal 200 karakter.")
    .optional(),
  status: agendaStatusEnum.default("UPCOMING"),
});

export const updateAgendaSchema = createAgendaSchema.partial();

// --- Achievements ---
export const createAchievementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  description: z
    .string()
    .max(5000, "Deskripsi maksimal 5.000 karakter.")
    .optional(),
  category: z.string().max(100, "Kategori maksimal 100 karakter.").optional(),
  date: z.string().optional(),
  imageUrl: z.string().url("URL gambar tidak valid.").optional().nullable(),
});

export const updateAchievementSchema = createAchievementSchema.partial();

// --- Site Settings ---
export const updateSiteSettingsSchema = z.object({
  siteName: z
    .string()
    .trim()
    .max(200, "Nama situs maksimal 200 karakter.")
    .optional(),
  siteDescription: z
    .string()
    .max(1000, "Deskripsi situs maksimal 1.000 karakter.")
    .optional(),
  contactEmail: z.string().email("Format email tidak valid.").optional(),
  contactPhone: z
    .string()
    .max(50, "Telepon maksimal 50 karakter.")
    .optional(),
  address: z.string().max(500, "Alamat maksimal 500 karakter.").optional(),
  logoUrl: z.string().url("URL logo tidak valid.").optional().nullable(),
  heroImageUrl: z
    .string()
    .url("URL gambar hero tidak valid.")
    .optional()
    .nullable(),
  footerText: z
    .string()
    .max(1000, "Teks footer maksimal 1.000 karakter.")
    .optional(),
});

// --- Enrollment (SPMB) ---
export const genderEnum = z.enum(["LAKI_LAKI", "PEREMPUAN"]);
export const programChoiceEnum = z.enum(["Zonasi", "Afirmasi", "Prestasi", "Perpindahan Tugas"]);

export const createEnrollmentSchema = z.object({
  nisn: z
    .string()
    .trim()
    .min(1, "NISN wajib diisi.")
    .max(20, "NISN maksimal 20 karakter."),
  fullName: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi.")
    .max(200, "Nama maksimal 200 karakter."),
  gender: genderEnum,
  dateOfBirth: z.string().min(1, "Tanggal lahir wajib diisi."),
  placeOfBirth: z
    .string()
    .trim()
    .min(1, "Tempat lahir wajib diisi.")
    .max(100, "Tempat lahir maksimal 100 karakter."),
  address: z
    .string()
    .trim()
    .min(1, "Alamat wajib diisi.")
    .max(500, "Alamat maksimal 500 karakter."),
  phone: z.string().max(20, "Telepon maksimal 20 karakter.").optional(),
  email: z.string().email("Format email tidak valid.").max(200).optional(),
  parentName: z
    .string()
    .trim()
    .min(1, "Nama orang tua wajib diisi.")
    .max(200, "Nama orang tua maksimal 200 karakter."),
  parentPhone: z
    .string()
    .trim()
    .min(1, "Telepon orang tua wajib diisi.")
    .max(20, "Telepon orang tua maksimal 20 karakter."),
  parentEmail: z.string().email("Format email tidak valid.").max(200).optional(),
  parentOccupation: z.string().max(100, "Pekerjaan orang tua maksimal 100 karakter.").optional(),
  previousSchool: z
    .string()
    .trim()
    .min(1, "Asal sekolah wajib diisi.")
    .max(200, "Asal sekolah maksimal 200 karakter."),
  previousSchoolAddress: z.string().max(500, "Alamat sekolah maksimal 500 karakter.").optional(),
  programChoice: programChoiceEnum,
  birthCertUrl: z.string().url("URL akta lahir tidak valid.").optional(),
  diplomaUrl: z.string().url("URL ijazah tidak valid.").optional(),
  photoUrl: z.string().url("URL foto tidak valid.").optional(),
});

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email("Format email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi."),
  newPassword: z
    .string()
    .min(6, "Password baru minimal 6 karakter.")
    .max(100, "Password baru maksimal 100 karakter."),
});

// --- Generic helpers ---
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues?.[0];
    const message = firstError?.message ?? "Validasi gagal.";
    return { ok: false as const, error: message };
  }
  return { ok: true as const, data: result.data };
}

// --- Students ---
export const createStudentSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi.").max(50, "NIS maksimal 50 karakter."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(200, "Nama maksimal 200 karakter."),
  classId: z.string().min(1, "Kelas wajib diisi."),
  nisn: z.string().max(20, "NISN maksimal 20 karakter.").optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["LAKI_LAKI", "PEREMPUAN"]).optional().nullable(),
  address: z.string().max(500, "Alamat maksimal 500 karakter.").optional().nullable(),
  phone: z.string().max(20, "Telepon maksimal 20 karakter.").optional().nullable(),
  email: z.string().email("Format email tidak valid.").max(200).optional().nullable(),
  parentName: z.string().max(200, "Nama orang tua maksimal 200 karakter.").optional().nullable(),
  parentPhone: z.string().max(20, "Telepon orang tua maksimal 20 karakter.").optional().nullable(),
});

export const updateStudentSchema = createStudentSchema.partial();

// --- Payments ---
export const createPaymentSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib diisi."),
  monthPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode bulan tidak valid (YYYY-MM)."),
  amount: z.number().int("Nominal harus berupa angka.").positive("Nominal harus positif.").max(1_000_000_000, "Nominal terlalu besar."),
  paymentDate: z.string().optional(),
  status: z.enum(["PAID", "UNPAID"]).default("PAID"),
  note: z.string().max(1000, "Catatan maksimal 1000 karakter.").optional().nullable(),
});

export const updatePaymentSchema = createPaymentSchema.partial().extend({
  id: z.string().cuid(),
});
