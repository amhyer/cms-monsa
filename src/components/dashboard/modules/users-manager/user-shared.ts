import type { RoleFilter } from "@/lib/user-roles";

export type Role = "OPERATOR" | "SUPER_ADMIN" | "GURU" | "ORANG_TUA" | "SISWA";

export type FormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
  guardianClassId: string;
  guardianStudentId: string;
  guardianStudentName: string;
  studentId: string;
  studentName: string;
  isActive: boolean;
};

export const EMPTY: FormState = {
  name: "",
  email: "",
  password: "",
  role: "OPERATOR",
  guardianClassId: "",
  guardianStudentId: "",
  guardianStudentName: "",
  studentId: "",
  studentName: "",
  isActive: true,
};

export type UserCounts = {
  all: number;
  STAFF: number;
  GURU: number;
  ORANG_TUA: number;
  SISWA: number;
};

export const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "STAFF", label: "Admin & Operator" },
  { value: "GURU", label: "Guru" },
  { value: "ORANG_TUA", label: "Orang Tua" },
  { value: "SISWA", label: "Siswa" },
];

export function roleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Admin";
    case "OPERATOR":
      return "Operator";
    case "GURU":
      return "Guru";
    case "ORANG_TUA":
      return "Orang Tua";
    case "SISWA":
      return "Siswa";
    default:
      return role;
  }
}

export function roleBadgeClass(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-gold text-gold-foreground";
    case "OPERATOR":
      return "bg-primary text-primary-foreground";
    case "GURU":
      return "bg-violet-600 text-white";
    case "ORANG_TUA":
      return "bg-teal-600 text-white";
    case "SISWA":
      return "bg-amber-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export type StudentOption = {
  id: string;
  name: string;
  className: string;
  nis: string;
};

export type ClassOption = { id: string; name: string };
