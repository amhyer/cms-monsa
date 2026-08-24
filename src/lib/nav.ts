import {
  LayoutDashboard,
  Newspaper,
  Megaphone,
  CalendarDays,
  Image,
  Trophy,
  Users,
  Mail,
  UserCog,
  Settings,
  ScrollText,
  Home,
  Building2,
  GraduationCap,
  Phone,
  ShieldAlert,
  ClipboardCheck,
  LayoutGrid,
  UserSquare2,
  UserCircle2,
  Wallet,
  BarChart3,
  Download,
  Network,
  TableProperties,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const PUBLIC_NAV: NavItem[] = [
  { label: "Beranda", path: "/", icon: Home },
  { label: "Profil", path: "/profile", icon: Building2 },
  { label: "Struktur Organisasi", path: "/struktur-organisasi", icon: Network },
  { label: "Akademik", path: "/academic", icon: GraduationCap },
  { label: "Berita", path: "/news", icon: Newspaper },
  { label: "Galeri", path: "/gallery", icon: Image },
  { label: "Transparansi", path: "/transparansi", icon: Wallet },
  { label: "Pengaduan", path: "/complaint", icon: ShieldAlert },
  { label: "Kontak", path: "/contact", icon: Phone },
];

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Ringkasan", path: "/dashboard", icon: LayoutDashboard },
  { label: "Profil Saya", path: "/dashboard/profile", icon: UserCircle2 },
  { label: "Berita & Artikel", path: "/dashboard/news", icon: Newspaper },
  { label: "Pengumuman", path: "/dashboard/announcements", icon: Megaphone },
  { label: "Agenda Sekolah", path: "/dashboard/agenda", icon: CalendarDays },
  { label: "Galeri Media", path: "/dashboard/gallery", icon: Image },
  { label: "Data Prestasi", path: "/dashboard/achievements", icon: Trophy },
  { label: "Guru & Staf", path: "/dashboard/teachers", icon: Users },
  { label: "Data Siswa", path: "/dashboard/students", icon: UserSquare2 },
  { label: "Struktur Organisasi", path: "/dashboard/org-structure", icon: Network, adminOnly: true },
  { label: "Transparansi Anggaran", path: "/dashboard/transparansi", icon: Wallet, adminOnly: true },
  { label: "Kelas", path: "/dashboard/classes", icon: LayoutGrid },
  { label: "Jadwal Pelajaran", path: "/dashboard/schedule", icon: TableProperties },
  { label: "Kehadiran Siswa", path: "/dashboard/attendance", icon: ClipboardCheck },
  { label: "Laporan", path: "/dashboard/reports", icon: BarChart3 },
  { label: "Penarikan Dapodik", path: "/dashboard/dapodik", icon: Download },
  { label: "Pengaduan", path: "/dashboard/complaints", icon: ShieldAlert },
  { label: "Pesan Masuk", path: "/dashboard/messages", icon: Mail },
  { label: "Manajemen Operator", path: "/dashboard/users", icon: UserCog, adminOnly: true },
  { label: "Pengaturan Sekolah", path: "/dashboard/settings", icon: Settings, adminOnly: true },
  { label: "Log Aktivitas", path: "/dashboard/logs", icon: ScrollText, adminOnly: true },
];

export const NEWS_CATEGORIES = ["Akademik", "Kegiatan", "Prestasi"] as const;
export const GALLERY_CATEGORIES = ["Kegiatan", "Prestasi", "Fasilitas", "Upacara"] as const;
export const AGENDA_CATEGORIES = ["Akademik", "Kegiatan", "Libur", "Umum"] as const;
export const ACHIEVEMENT_LEVELS = [
  "Sekolah",
  "Kecamatan",
  "Kabupaten",
  "Provinsi",
  "Nasional",
  "Internasional",
] as const;
export const ACHIEVEMENT_CATEGORIES = ["Akademik", "Non-Akademik"] as const;
