"use client";

import type { Dispatch, SetStateAction } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_SLOTS } from "./schedule-helpers";
import type { ClassItem } from "@/lib/types";

type ScheduleFiltersProps = {
  academicYear: string;
  academicYears: string[];
  onAcademicYearChange: Dispatch<SetStateAction<string>>;
  classFilter: string;
  onClassFilterChange: Dispatch<SetStateAction<string>>;
  classes: ClassItem[];
  classMap: Map<string, string>;
  waliClassId: string | null;
  slotCount: number;
  onSlotCountChange: Dispatch<SetStateAction<number>>;
  entryCount: number;
};

export function ScheduleFilters({
  academicYear,
  academicYears,
  onAcademicYearChange,
  classFilter,
  onClassFilterChange,
  classes,
  classMap,
  waliClassId,
  slotCount,
  onSlotCountChange,
  entryCount,
}: ScheduleFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-xs">Tahun Ajaran</Label>
        <Select value={academicYear} onValueChange={onAcademicYearChange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {academicYears.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Kelas</Label>
        {waliClassId ? (
          <div
            className="flex h-9 w-[180px] items-center rounded-md border bg-muted px-3 text-sm font-medium"
            title="Guru wali hanya melihat jadwal kelasnya"
          >
            {classMap.get(waliClassId) ?? "Kelas wali Anda"}
          </div>
        ) : (
          <Select value={classFilter} onValueChange={onClassFilterChange}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Jam ke-</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => onSlotCountChange((s) => Math.max(1, s - 1))} disabled={slotCount <= 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-8 text-center text-sm font-medium">{slotCount}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => onSlotCountChange((s) => Math.min(MAX_SLOTS, s + 1))} disabled={slotCount >= MAX_SLOTS}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <Badge variant="outline" className="ml-auto">
        {classFilter === "all" ? "Semua Kelas" : classMap.get(classFilter) ?? classFilter} — {academicYear} · {entryCount} jadwal
      </Badge>
    </div>
  );
}
