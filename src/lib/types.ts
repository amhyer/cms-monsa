// Shared application types & role constants

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  OPERATOR: "OPERATOR",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
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
  order: number;
  isActive: boolean;
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
  level: string;
  category: string;
  date: string;
};

export type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
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
