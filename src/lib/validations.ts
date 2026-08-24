import { z } from "zod";

// --- URL gambar CMS ---
// /api/upload mengembalikan path relatif ("/uploads/..."), jadi validasi hanya
// menerima path relatif atau URL absolut http(s). String kosong diizinkan agar
// form bisa menghapus gambar ("" dipetakan ke null di route).
export const imageUrl = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v),
    "URL gambar tidak valid."
  );

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
  coverImage: imageUrl.optional().nullable(),
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
  imageUrl: imageUrl.optional(),
  url: imageUrl.optional(),
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
  imageUrl: imageUrl.optional(),
  url: imageUrl.optional(),
  category: z.string().max(100).optional(),
});

// --- Teachers ---

// Field profil opsional (identitas dari Dapodik bisa diedit manual, blok
// kontak & personal ditulis admin). Semua opsional & boleh null = kosongkan.
const teacherProfileFields = {
  position: z.string().trim().max(100, "Jabatan maksimal 100 karakter.").optional(),
  nik: z.string().trim().max(20, "NIK maksimal 20 karakter.").optional().nullable(),
  tempatLahir: z.string().trim().max(100, "Tempat lahir maksimal 100 karakter.").optional().nullable(),
  tanggalLahir: z.string().optional().nullable(), // ISO date; null = hapus
  gender: z.string().trim().max(20).optional().nullable(), // LAKI_LAKI | PEREMPUAN
  agama: z.string().trim().max(50, "Agama maksimal 50 karakter.").optional().nullable(),
  statusKepegawaian: z.string().trim().max(60).optional().nullable(),
  jenisPtk: z.string().trim().max(100).optional().nullable(),
  pangkatGolongan: z.string().trim().max(50).optional().nullable(),
  bidangStudi: z.string().trim().max(100).optional().nullable(),
  education: z.string().trim().max(200, "Pendidikan maksimal 200 karakter.").optional().nullable(),
  phone: z.string().trim().max(30, "No. HP maksimal 30 karakter.").optional().nullable(),
  email: z.union([z.string().email("Format email tidak valid.").trim().max(120), z.literal("")]).optional().nullable(),
  motto: z.string().trim().max(200, "Motto maksimal 200 karakter.").optional().nullable(),
  riwayat: z.string().trim().max(2000, "Riwayat maksimal 2.000 karakter.").optional().nullable(),
  sertifikasi: z.string().trim().max(2000, "Sertifikasi/Diklat maksimal 2.000 karakter.").optional().nullable(),
  prestasi: z.string().trim().max(2000, "Prestasi maksimal 2.000 karakter.").optional().nullable(),
  badges: z.string().trim().max(200, "Badge maksimal 200 karakter.").optional().nullable(),
};

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
  imageUrl: imageUrl.optional().nullable(),
  order: z.number().int().min(0).default(0),
  ...teacherProfileFields,
});

export const updateTeacherSchema = createTeacherSchema.partial();

// Petakan field profil (boleh undefined/null/string kosong -> null di DB).
function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function teacherProfileData(d: Record<string, unknown>) {
  const tanggalLahir = d.tanggalLahir;
  return {
    nik: s(d.nik),
    tempatLahir: s(d.tempatLahir),
    tanggalLahir: tanggalLahir ? new Date(String(tanggalLahir)) : null,
    gender: s(d.gender),
    agama: s(d.agama),
    statusKepegawaian: s(d.statusKepegawaian),
    jenisPtk: s(d.jenisPtk),
    pangkatGolongan: s(d.pangkatGolongan),
    bidangStudi: s(d.bidangStudi),
    education: s(d.education),
    phone: s(d.phone),
    email: s(d.email),
    motto: s(d.motto),
    riwayat: s(d.riwayat),
    sertifikasi: s(d.sertifikasi),
    prestasi: s(d.prestasi),
    badges: s(d.badges),
  };
}

// --- Users ---
export const userRoleEnum = z.enum(["SUPER_ADMIN", "OPERATOR", "GURU", "ORANG_TUA", "SISWA"]);

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
  studentId: z.string().nullable().optional(),
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
  imageUrl: imageUrl.optional().nullable(),
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
  logoUrl: imageUrl.optional().nullable(),
  heroImageUrl: imageUrl.optional().nullable(),
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
  birthCertUrl: imageUrl.optional(),
  diplomaUrl: imageUrl.optional(),
  photoUrl: imageUrl.optional(),
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
  photoUrl: imageUrl.optional().nullable(),
});

export const updateStudentSchema = createStudentSchema.partial();

// --- Org Structure ---
export const createOrgStructureSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(100, "Nama maksimal 100 karakter."),
  position: z
    .string()
    .trim()
    .min(1, "Jabatan wajib diisi.")
    .max(100, "Jabatan maksimal 100 karakter."),
  photo: imageUrl.optional().nullable(),
  // Identifier Dapodik (opsional, untuk pengecekan silang)
  nuptk: z.string().trim().max(20, "NUPTK maksimal 20 karakter.").optional().nullable(),
  nip: z.string().trim().max(20, "NIP maksimal 20 karakter.").optional().nullable(),
  // Profil publik (tampil di modal detail halaman Struktur Organisasi)
  bio: z.string().trim().max(500, "Profil singkat maksimal 500 karakter.").optional().nullable(),
  contact: z.string().trim().max(100, "Kontak maksimal 100 karakter.").optional().nullable(),
  nik: z.string().trim().max(20, "NIK maksimal 20 karakter.").optional().nullable(),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateOrgStructureSchema = createOrgStructureSchema.partial();

// --- Transparansi Anggaran (ARKAS / Dana BOS) ---
export const createBosExpenditureSchema = z.object({
  year: z
    .number()
    .int("Tahun harus berupa angka bulat.")
    .min(2000, "Tahun minimal 2000.")
    .max(2100, "Tahun maksimal 2100."),
  source: z.string().min(1, "Sumber dana wajib diisi."),
  category: z.string().min(1, "Kategori belanja wajib diisi."),
  item: z.string().min(1, "Uraian belanja wajib diisi."),
  amount: z
    .number()
    .int("Nominal harus berupa angka bulat.")
    .positive("Nominal harus positif.")
    .max(1_000_000_000_000, "Nominal terlalu besar."),
  quarter: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .nullable(),
  note: z.string().max(2000, "Catatan maksimal 2000 karakter.").optional().nullable(),
});

export const updateBosExpenditureSchema = createBosExpenditureSchema.partial();

// Dokumen transparansi (output ARKAS / bukti belanja BOS dalam PDF)
export const createBosDocumentSchema = z.object({
  year: z
    .number()
    .int("Tahun harus berupa angka bulat.")
    .min(2000, "Tahun minimal 2000.")
    .max(2100, "Tahun maksimal 2100."),
  title: z
    .string()
    .trim()
    .min(1, "Judul dokumen wajib diisi.")
    .max(200, "Judul maksimal 200 karakter."),
  description: z
    .string()
    .max(2000, "Deskripsi maksimal 2000 karakter.")
    .optional()
    .nullable(),
});

// --- Albums (Gallery) ---
export const createAlbumSchema = z.object({
  name: z.string().trim().min(1, "Nama album wajib diisi.").max(200, "Nama album maksimal 200 karakter."),
  description: z.string().max(2000, "Deskripsi maksimal 2.000 karakter.").optional(),
  coverUrl: imageUrl.optional().nullable(),
  category: z.string().max(100, "Kategori maksimal 100 karakter.").optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// --- School Documents ---
export const createSchoolDocumentSchema = z.object({
  title: z.string().trim().min(1, "Judul dokumen wajib diisi.").max(200, "Judul dokumen maksimal 200 karakter."),
  description: z.string().max(2000, "Deskripsi maksimal 2.000 karakter.").optional(),
  category: z.string().max(100, "Kategori maksimal 100 karakter.").optional(),
  fileUrl: z.string().trim().min(1, "File dokumen wajib diunggah."),
  fileName: z.string().max(200, "Nama file maksimal 200 karakter.").optional(),
  fileSize: z.number().int().min(0).optional(),
  fileType: z.string().max(50, "Tipe file maksimal 50 karakter.").optional(),
  version: z.string().max(20, "Versi maksimal 20 karakter.").optional(),
  accessLevel: z.enum(["PUBLIC", "STAFF", "ADMIN"]).optional(),
});

// --- School Events ---
export const createSchoolEventSchema = z.object({
  title: z.string().trim().min(1, "Judul event wajib diisi.").max(200, "Judul event maksimal 200 karakter."),
  description: z.string().max(5000, "Deskripsi maksimal 5.000 karakter.").optional(),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi."),
  endDate: z.string().optional(),
  location: z.string().max(200, "Lokasi maksimal 200 karakter.").optional(),
  category: z.string().max(100, "Kategori maksimal 100 karakter.").optional(),
  type: z.enum(["EVENT", "HOLIDAY", "EXAM", "MEETING"]).optional(),
  isAllDay: z.boolean().optional(),
  color: z.string().max(20, "Warna maksimal 20 karakter.").optional(),
  imageUrl: imageUrl.optional().nullable(),
  maxParticipants: z.number().int().positive().optional().nullable(),
  requiresRegistration: z.boolean().optional(),
});

// --- Schedule ---
export const createScheduleEntrySchema = z.object({
  day: z.string().min(1, "Hari wajib diisi."),
  timeSlot: z.number().int().positive("Jam ke- harus positif."),
  timeLabel: z.string().max(50, "Label jam maksimal 50 karakter.").optional(),
  subject: z.string().trim().min(1, "Mata pelajaran wajib diisi.").max(200, "Mata pelajaran maksimal 200 karakter."),
  teacherId: z.string().optional().nullable(),
  roomId: z.string().max(50, "Ruang maksimal 50 karakter.").optional().nullable(),
  classId: z.string().optional().nullable(),
  academicYear: z.string().min(1, "Tahun ajaran wajib diisi."),
});

// --- Testimonials ---
export const createTestimonialSchema = z.object({
  parentName: z.string().trim().min(1, "Nama wajib diisi.").max(100, "Nama maksimal 100 karakter."),
  studentName: z.string().max(100, "Nama siswa maksimal 100 karakter.").optional(),
  className: z.string().max(50, "Kelas maksimal 50 karakter.").optional(),
  relation: z.string().max(50, "Hubungan maksimal 50 karakter.").optional(),
  content: z.string().trim().min(1, "Testimoni wajib diisi.").max(5000, "Testimoni maksimal 5.000 karakter."),
  rating: z.number().int().min(1, "Rating minimal 1.").max(5, "Rating maksimal 5."),
  photoUrl: imageUrl.optional().nullable(),
});

// --- Teacher Ratings ---
export const createTeacherRatingSchema = z.object({
  rating: z.number().int().min(1, "Rating minimal 1.").max(5, "Rating maksimal 5."),
  comment: z.string().max(2000, "Komentar maksimal 2.000 karakter.").optional(),
  authorName: z.string().max(100, "Nama penulis maksimal 100 karakter.").optional(),
});

// --- Teacher Meetings ---
export const createTeacherMeetingSchema = z.object({
  slotId: z.string().min(1, "Slot waktu wajib dipilih."),
  parentName: z.string().trim().min(1, "Nama orang tua wajib diisi.").max(200, "Nama maksimal 200 karakter."),
  studentName: z.string().trim().min(1, "Nama siswa wajib diisi.").max(200, "Nama siswa maksimal 200 karakter."),
  phone: z.string().max(20, "Telepon maksimal 20 karakter.").optional(),
  purpose: z.string().max(500, "Tujuan maksimal 500 karakter.").optional(),
});

// --- Student Achievements ---
export const createStudentAchievementSchema = z.object({
  title: z.string().trim().min(1, "Judul prestasi wajib diisi.").max(200, "Judul prestasi maksimal 200 karakter."),
  description: z.string().max(2000, "Deskripsi maksimal 2.000 karakter.").optional(),
  category: z.string().max(100, "Kategori maksimal 100 karakter.").optional(),
  level: z.string().max(100, "Tingkat maksimal 100 karakter.").optional(),
  date: z.string().min(1, "Tanggal prestasi wajib diisi."),
  certificate: imageUrl.optional().nullable(),
  issuedBy: z.string().max(200, "Pihak penerbit maksimal 200 karakter.").optional(),
});

// --- Star of Month ---
export const createStarOfMonthSchema = z.object({
  type: z.enum(["STUDENT", "TEACHER"]),
  month: z.number().int().min(1, "Bulan minimal 1.").max(12, "Bulan maksimal 12."),
  year: z.number().int().min(2000, "Tahun minimal 2000.").max(2100, "Tahun maksimal 2100."),
  studentId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  reason: z.string().trim().min(1, "Alasan wajib diisi.").max(500, "Alasan maksimal 500 karakter."),
  achievement: z.string().max(500, "Pencapaian maksimal 500 karakter.").optional(),
  photoUrl: imageUrl.optional().nullable(),
});
