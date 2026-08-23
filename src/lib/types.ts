// Shared application types & role constants

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OPERATOR: "OPERATOR",
  GURU: "GURU",
  ORANG_TUA: "ORANG_TUA",
  SISWA: "SISWA",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Human-readable labels for the dashboard UI. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATOR: "Operator",
  GURU: "Guru",
  ORANG_TUA: "Orang Tua",
  SISWA: "Siswa",
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  guardianClassId: string | null;
  guardianStudentId: string | null;
};

export type NewsCategory = "Akademik" | "Kegiatan" | "Prestasi";
export type NewsStatus = "DRAFT" | "PUBLISHED";
export type GalleryType = "PHOTO" | "VIDEO";

export type NewsItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  category: string;
  status: string;
  authorId: string;
  authorName?: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  location: string | null;
  category: string;
  createdAt: string;
};

export type TeacherItem = {
  id: string;
  name: string;
  position: string;
  subject: string | null;
  education: string | null;
  photo: string | null;
  nuptk: string | null;
  nip: string | null;
  nik: string | null;
  gender: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  agama: string | null;
  statusKepegawaian: string | null;
  jenisPtk: string | null;
  pangkatGolongan: string | null;
  bidangStudi: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  riwayat: string | null;
  sertifikasi: string | null;
  prestasi: string | null;
  badges: string | null;
  cvUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  order: number;
  isActive: boolean;
  homeroomClasses?: Array<{ id: string; name: string }>;
};

export type OrgStructureItem = {
  id: string;
  name: string;
  position: string;
  photo: string | null;
  nuptk: string | null;
  nip: string | null;
  nik: string | null;
  bio: string | null;
  contact: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BosExpenditureItem = {
  id: string;
  year: number;
  source: string;
  category: string;
  item: string;
  amount: number;
  quarter: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BosDocumentItem = {
  id: string;
  year: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string;
  thumbnail: string | null;
  category: string;
  createdAt: string;
};

export type AchievementItem = {
  id: string;
  title: string;
  description: string | null;
  studentName: string | null;
  studentId: string | null;
  studentNis: string | null;
  studentNisn: string | null;
  level: string;
  category: string;
  date: string;
};

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  guardianClassId: string | null;
  guardianClassName?: string;
  guardianStudentId?: string | null;
  guardianStudentName?: string | null;
  guardianStudentClassName?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  studentClassName?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ActivityLogItem = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string;
  createdAt: string;
};

export type SiteSettingItem = {
  id: string;
  schoolName: string;
  npsn: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string;
  mapEmbed: string | null;
  vision: string;
  mission: string;
  history: string;
  principalName: string;
  principalPhoto: string | null;
  principalWelcome: string;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  studentCount: number;
  teacherCount: number;
  facilityCount: number;
  achievementCount: number;
  spmbInfo: string;
  spmbLink: string | null;
  updatedAt: string;
};

export type ContactMessageItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type StudentItem = {
  id: string;
  nis: string;
  nisn: string | null;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  parentName: string | null;
  parentPhone: string | null;
  photoUrl: string | null;
  classId: string;
  className?: string;
  isActive: boolean;
  createdAt: string;
};

export type ClassItem = {
  id: string;
  name: string;
  grade: string;
  stream: string | null;
  academicYear: string;
  homeroomTeacherId: string | null;
  homeroomTeacherName?: string;
  studentCount?: number;
  isActive: boolean;
};

export type AttendanceStatus = "HADIR" | "SAKIT" | "IZIN" | "ALFA";

export type AttendanceRow = {
  studentId: string;
  nis: string;
  nisn: string | null;
  name: string;
  gender: string | null;
  parentName: string | null;
  attendanceId: string | null;
  status: AttendanceStatus | null;
  note: string | null;
};

