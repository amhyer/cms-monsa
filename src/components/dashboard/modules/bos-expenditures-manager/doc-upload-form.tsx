"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/format";
import type { DocFormState } from "./form-state";

type DocUploadFormProps = {
  form: DocFormState;
  setForm: Dispatch<SetStateAction<DocFormState>>;
  file: File | null;
  onFileChange: (file: File | null) => void;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function DocUploadForm({
  form,
  setForm,
  file,
  onFileChange,
  uploading,
  onSubmit,
}: DocUploadFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-center gap-2">
        <Upload className="size-4" />
        <h3 className="font-semibold">Upload Dokumen PDF</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Output ARKAS atau bukti belanja dana BOS — file PDF diunggah
        langsung dan tampil di halaman Transparansi untuk diunduh publik.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="d-year">Tahun Anggaran</Label>
          <Input
            id="d-year"
            type="number"
            min={2000}
            max={2100}
            value={form.year}
            onChange={(e) =>
              setForm({
                ...form,
                year: Number(e.target.value) || 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-title">Judul Dokumen</Label>
          <Input
            id="d-title"
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            placeholder="Mis. Output ARKAS 2026, SPJ Belanja TW 1"
          />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor="d-desc">Deskripsi (opsional)</Label>
        <Input
          id="d-desc"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          placeholder="Keterangan singkat dokumen"
        />
      </div>
      <div className="mt-3 space-y-2">
        <Label htmlFor="d-file">File PDF</Label>
        <Input
          id="d-file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={uploading}>
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload PDF
        </Button>
        {file && (
          <span className="truncate text-sm text-muted-foreground">
            {file.name} · {formatBytes(file.size)}
          </span>
        )}
      </div>
    </form>
  );
}
