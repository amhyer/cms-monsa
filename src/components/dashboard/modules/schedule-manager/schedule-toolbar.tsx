"use client";

import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DAYS } from "@/lib/schedule-constants";
import { exportToCsv, exportScheduleToPdf } from "@/lib/export";
import type { ScheduleEntryItem } from "@/lib/types";

type ScheduleToolbarProps = {
  entries: ScheduleEntryItem[];
  classFilter: string;
  academicYear: string;
  classMap: Map<string, string>;
  onImportTemplate: () => void;
};

export function ScheduleToolbar({
  entries,
  classFilter,
  academicYear,
  classMap,
  onImportTemplate,
}: ScheduleToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Jadwal Pelajaran</h2>
        <p className="text-sm text-muted-foreground">
          Klik sel kosong (+) untuk menambah, klik jadwal untuk mengedit. Seret jadwal untuk memindahkan.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onImportTemplate}>
          <Plus className="size-4" /> Import Template
        </Button>
        <Button variant="outline" size="sm" disabled={entries.length === 0}
          onClick={() => {
            exportToCsv(
              `jadwal-${classFilter === "all" ? "semua" : classFilter}-${academicYear}`,
              entries.map((e) => ({
                day: e.day,
                timeSlot: e.timeSlot,
                timeLabel: e.timeLabel ?? "",
                subject: e.subject,
                teacherName: e.teacherName ?? "",
                roomId: e.roomId ?? "",
                academicYear: e.academicYear,
              })),
              [
                { key: "day", label: "Hari" },
                { key: "timeSlot", label: "Jam ke-" },
                { key: "timeLabel", label: "Waktu" },
                { key: "subject", label: "Mata Pelajaran" },
                { key: "teacherName", label: "Guru" },
                { key: "roomId", label: "Ruang" },
                { key: "academicYear", label: "Tahun Ajaran" },
              ]
            );
            toast.success("Jadwal diekspor ke CSV.");
          }}>
          <Download className="size-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" disabled={entries.length === 0}
          onClick={() => {
            const cls = classFilter === "all" ? "Semua Kelas" : classMap.get(classFilter) ?? classFilter;
            exportScheduleToPdf({ entries, days: DAYS, className: cls, academicYear });
            toast.success("Jadwal diekspor ke PDF.");
          }}>
          <Download className="size-4" /> PDF
        </Button>
      </div>
    </div>
  );
}
