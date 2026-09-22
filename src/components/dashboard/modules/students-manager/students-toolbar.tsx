"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClassItem } from "@/lib/types";

type StudentsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  classes: ClassItem[];
  shownCount: number;
  totalCount: number;
};

export function StudentsToolbar({
  search,
  onSearchChange,
  classFilter,
  onClassFilterChange,
  classes,
  shownCount,
  totalCount,
}: StudentsToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cari nama, NIS, NISN, ortu…"
          className="w-full sm:max-w-xs"
        />
      </div>
      <Select value={classFilter} onValueChange={onClassFilterChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Semua kelas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Kelas</SelectItem>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="ml-auto text-xs text-muted-foreground">
        {shownCount} dari {totalCount} siswa
      </span>
    </div>
  );
}
