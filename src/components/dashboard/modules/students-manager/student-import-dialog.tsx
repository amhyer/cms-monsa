"use client";

import { useState } from "react";
import { Download, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ClassItem } from "@/lib/types";
import { exportToCsv } from "@/lib/export";

type ImportRow = {
  nis: string;
  name: string;
  classId: string;
  nisn?: string;
  gender?: string;
  parentName?: string;
};

type StudentImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassItem[];
  onImported: () => void;
};

export function StudentImportDialog({
  open,
  onOpenChange,
  classes,
  onImported,
}: StudentImportDialogProps) {
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);

  function downloadImportTemplate() {
    exportToCsv("template-import-siswa", [
      { NIS: "12345", Nama: "Contoh Siswa", Kelas: "1A", NISN: "0091234567", "Jenis Kelamin": "LAKI_LAKI", "Nama Orang Tua": "Bapak Contoh" },
    ], [
      { key: "NIS", label: "NIS" },
      { key: "Nama", label: "Nama" },
      { key: "Kelas", label: "Kelas" },
      { key: "NISN", label: "NISN" },
      { key: "Jenis Kelamin", label: "Jenis Kelamin" },
      { key: "Nama Orang Tua", label: "Nama Orang Tua" },
    ]);
  }

  function parseImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) {
        toast.error("File kosong.");
        return;
      }
      // Header baris pertama: NIS,Nama,Kelas,NISN,Jenis Kelamin,Nama Orang Tua
      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const col = (h: string) => header.indexOf(h);
      const iNis = col("NIS"), iName = col("Nama"), iClass = col("Kelas");
      if (iNis < 0 || iName < 0 || iClass < 0) {
        toast.error("Format header tidak dikenali. Gunakan template.");
        return;
      }
      const byName = new Map(classes.map((c) => [c.name, c.id]));
      const rows = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const get = (i: number) => (i >= 0 ? cells[i]?.trim() ?? "" : "");
        const className = get(iClass);
        const classId = byName.get(className) ?? (classes.some((c) => c.id === className) ? className : "");
        const row: ImportRow = {
          nis: get(iNis),
          name: get(iName),
          classId,
        };
        const iNisn = col("NISN"), iGender = col("Jenis Kelamin"), iParent = col("Nama Orang Tua");
        if (iNisn >= 0) row.nisn = get(iNisn);
        if (iGender >= 0) row.gender = get(iGender);
        if (iParent >= 0) row.parentName = get(iParent);
        return row;
      }).filter((r) => r.nis && r.name);
      setImportRows(rows);
      toast.success(`${rows.length} baris dibaca dari file.`);
    };
    reader.onerror = () => toast.error("Gagal membaca file.");
    reader.readAsText(file, "utf-8");
  }

  async function handleImportSubmit() {
    if (importRows.length === 0) return;
    setImportBusy(true);
    try {
      const res = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: importRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import");
      const failCount = (data.errors ?? []).length;
      toast.success(
        `${data.created} siswa baru, ${data.updated} diperbarui${failCount > 0 ? `, ${failCount} gagal` : ""}.`
      );
      onOpenChange(false);
      setImportRows([]);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal import.");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Siswa dari CSV</DialogTitle>
          <DialogDescription>
            Unggah file CSV dengan kolom: NIS, Nama, Kelas, NISN, Jenis
            Kelamin, Nama Orang Tua. Siswa dengan NIS yang sama akan
            diperbarui (bukan duplikat).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadImportTemplate}>
              <Download className="size-4" /> Unduh Template
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted">
              <Upload className="size-4" />
              Pilih File CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseImportFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="text-sm text-muted-foreground">
            {importRows.length > 0
              ? `${importRows.length} baris siap diimport (kelas yang tidak cocok dengan data kelas akan dilewati).`
              : "Belum ada file yang dibaca."}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importBusy}
          >
            Batal
          </Button>
          <Button onClick={handleImportSubmit} disabled={importBusy || importRows.length === 0}>
            {importBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Mengimpor…
              </>
            ) : (
              <>
                <Save className="size-4" /> Import {importRows.length || ""} Siswa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Simple RFC-4180-ish CSV line parser (supports quoted fields). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}
