export type TemplateEntry = {
  day: string;
  timeSlot: number;
  timeLabel: string;
  subject: string;
};

export type ScheduleTemplate = {
  id: string;
  label: string;
  description: string;
  entries: TemplateEntry[];
};

/** Slot waktu standar SD (7 jam pelajaran). */
const SLOTS: { slot: number; label: string }[] = [
  { slot: 1, label: "07.00–07.35" },
  { slot: 2, label: "07.35–08.10" },
  { slot: 3, label: "08.15–08.50" },
  { slot: 4, label: "08.50–09.25" },
  { slot: 5, label: "09.35–10.10" },
  { slot: 6, label: "10.15–10.50" },
  { slot: 7, label: "10.50–11.25" },
];

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;

function buildEntries(grid: Record<string, string[]>): TemplateEntry[] {
  const entries: TemplateEntry[] = [];
  for (const day of DAYS) {
    const subjects = grid[day] ?? [];
    subjects.forEach((subject, i) => {
      if (subject && i < SLOTS.length) {
        entries.push({ day, timeSlot: SLOTS[i].slot, timeLabel: SLOTS[i].label, subject });
      }
    });
  }
  return entries;
}

// ── Kelas 1–3 (Tematik) ──────────────────────────────────────────────
const tematikGrid: Record<string, string[]> = {
  Senin: ["Pendidikan Agama", "Tematik", "Tematik", "Bahasa Indonesia", "Matematika", "PJOK", "Seni Budaya"],
  Selasa: ["Pendidikan Agama", "Tematik", "Tematik", "Bahasa Indonesia", "Matematika", "PJOK", "Mulok"],
  Rabu: ["Pendidikan Agama", "Tematik", "Tematik", "Bahasa Indonesia", "Matematika", "PJOK", "Seni Budaya"],
  Kamis: ["Pendidikan Agama", "Tematik", "Tematik", "Matematika", "Bahasa Indonesia", "PJOK", "Mulok"],
  Jumat: ["Pendidikan Agama", "Tematik", "Tematik", "Bahasa Indonesia", "Matematika", "Seni Budaya", "Mulok"],
};

// ── Kelas 4–6 (Mapel Terpisah) ────────────────────────────────────────
const mapelGrid: Record<string, string[]> = {
  Senin: ["Pendidikan Agama", "PPKn", "Bahasa Indonesia", "Matematika", "IPA", "PJOK", "Seni Budaya"],
  Selasa: ["Pendidikan Agama", "PPKn", "Bahasa Indonesia", "Matematika", "IPS", "PJOK", "Mulok"],
  Rabu: ["Pendidikan Agama", "PPKn", "Bahasa Indonesia", "Matematika", "IPA", "PJOK", "Seni Budaya"],
  Kamis: ["Pendidikan Agama", "PPKn", "Matematika", "Bahasa Indonesia", "IPS", "PJOK", "Mulok"],
  Jumat: ["Pendidikan Agama", "PPKn", "Bahasa Indonesia", "Matematika", "PJOK", "Seni Budaya", "Mulok"],
};

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "kelas-1",
    label: "Kelas 1 (Tematik)",
    description: "7 jam, 5 hari — Tematik Terpadu",
    entries: buildEntries(tematikGrid),
  },
  {
    id: "kelas-2",
    label: "Kelas 2 (Tematik)",
    description: "7 jam, 5 hari — Tematik Terpadu",
    entries: buildEntries(tematikGrid),
  },
  {
    id: "kelas-3",
    label: "Kelas 3 (Tematik)",
    description: "7 jam, 5 hari — Tematik Terpadu",
    entries: buildEntries(tematikGrid),
  },
  {
    id: "kelas-4",
    label: "Kelas 4 (Mapel Terpisah)",
    description: "7 jam, 5 hari — Mata pelajaran terpisah",
    entries: buildEntries(mapelGrid),
  },
  {
    id: "kelas-5",
    label: "Kelas 5 (Mapel Terpisah)",
    description: "7 jam, 5 hari — Mata pelajaran terpisah",
    entries: buildEntries(mapelGrid),
  },
  {
    id: "kelas-6",
    label: "Kelas 6 (Mapel Terpisah)",
    description: "7 jam, 5 hari — Mata pelajaran terpisah",
    entries: buildEntries(mapelGrid),
  },
];
