import type { Day } from "@/lib/schedule-constants";
import { currentAcademicYear } from "./schedule-helpers";

export type FormState = {
  day: Day;
  timeSlot: number;
  timeLabel: string;
  subject: string;
  teacherId: string;
  roomId: string;
  classId: string;
  academicYear: string;
};

export const EMPTY_FORM: FormState = {
  day: "Senin",
  timeSlot: 1,
  timeLabel: "",
  subject: "",
  teacherId: "",
  roomId: "",
  classId: "",
  academicYear: currentAcademicYear(),
};
