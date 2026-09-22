"use client";

import { Download, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type StudentsPageHeaderProps = {
  exportDisabled: boolean;
  onExport: () => void;
  onImport: () => void;
  onCreate: () => void;
};

export function StudentsPageHeader({
  exportDisabled,
  onExport,
  onImport,
  onCreate,
}: StudentsPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Data Siswa</h2>
        <p className="text-sm text-muted-foreground">
          Kelola data siswa dan rombongan belajar (kelas).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={exportDisabled}
        >
          <Download className="size-4" /> Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onImport}
        >
          <Upload className="size-4" /> Import CSV
        </Button>
        <Button
          onClick={onCreate}
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <Plus className="size-4" /> Tambah Siswa
        </Button>
      </div>
    </div>
  );
}
