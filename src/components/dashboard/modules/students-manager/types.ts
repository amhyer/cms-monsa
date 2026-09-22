import type { StudentItem } from "@/lib/types";
import { toDateInputValue } from "../../_shared";

export type FormState = {
  nis: string;
  nisn: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  photoUrl: string;
  classId: string;
  isActive: boolean;
};

export const EMPTY: FormState = {
  nis: "",
  nisn: "",
  name: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  phone: "",
  email: "",
  parentName: "",
  parentPhone: "",
  photoUrl: "",
  classId: "",
  isActive: true,
};

/** Maps an existing student record onto the form state shape (edit flow). */
export function formStateFromStudent(s: StudentItem): FormState {
  return {
    nis: s.nis,
    nisn: s.nisn ?? "",
    name: s.name,
    dateOfBirth: toDateInputValue(s.dateOfBirth),
    gender: s.gender ?? "",
    address: s.address ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    parentName: s.parentName ?? "",
    parentPhone: s.parentPhone ?? "",
    photoUrl: s.photoUrl ?? "",
    classId: s.classId,
    isActive: s.isActive,
  };
}
