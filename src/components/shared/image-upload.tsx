"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, X, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  value: string | null | undefined;
  onChange: (url: string) => void;
  label?: string;
  aspect?: "video" | "square";
  helperText?: string;
};

/**
 * Image picker used in the CMS. Supports uploading a file (POST /api/upload)
 * or pasting an image URL directly.
 */
export function ImageUpload({
  value,
  onChange,
  label = "Gambar",
  aspect = "video",
  helperText,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah");
      onChange(data.url);
      toast.success("Gambar berhasil diunggah.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah gambar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowUrl((s) => !s)}
        >
          <Link2 className="size-3.5" />
          {showUrl ? "Unggah file" : "Gunakan URL"}
        </Button>
      </div>

      {showUrl ? (
        <Input
          placeholder="https://..."
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div
          className={`relative group overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40 ${
            aspect === "square" ? "aspect-square" : "aspect-video"
          }`}
        >
          {value ? (
            <>
              <img
                src={value}
                alt="preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Hapus gambar"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Upload className="size-6" />
              )}
              <span className="text-sm">
                {uploading ? "Mengunggah..." : "Klik untuk unggah gambar"}
              </span>
            </button>
          )}
          {value && !uploading && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              Ganti
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
