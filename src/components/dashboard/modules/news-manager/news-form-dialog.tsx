"use client";

import type { Dispatch, SetStateAction } from "react";
import { Eye, Loader2, Pencil as PencilIcon, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/shared/image-upload";
import { NEWS_CATEGORIES } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import type { NewsItem } from "@/lib/types";
import { RichTextEditor } from "./rich-text-editor";
import type { FormState } from "./form-state";

type NewsFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: NewsItem | null;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  previewMode: boolean;
  setPreviewMode: (preview: boolean) => void;
  saving: boolean;
  onSave: () => void;
};

export function NewsFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  previewMode,
  setPreviewMode,
  saving,
  onSave,
}: NewsFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl custom-scroll">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>
                {editing ? "Edit Berita" : "Tambah Berita"}
                {previewMode && " — Pratinjau"}
              </DialogTitle>
              <DialogDescription>
                {previewMode
                  ? "Tampilan pratinjau seperti yang akan dilihat pengunjung."
                  : editing
                  ? "Perbarui detail berita lalu simpan."
                  : "Lengkapi formulir di bawah untuk menerbitkan berita baru."}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 rounded-md border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={!previewMode ? "default" : "ghost"}
                className="h-7"
                onClick={() => setPreviewMode(false)}
              >
                <PencilIcon className="size-3.5" /> Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewMode ? "default" : "ghost"}
                className="h-7"
                onClick={() => setPreviewMode(true)}
              >
                <Eye className="size-3.5" /> Pratinjau
              </Button>
            </div>
          </div>
        </DialogHeader>

        {previewMode ? (
          <article className="space-y-4 rounded-lg border bg-background p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                {form.category}
              </Badge>
              <Badge
                variant="outline"
                className={
                  form.status === "PUBLISHED"
                    ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {form.status === "PUBLISHED" ? "Published" : "Draft"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(new Date().toISOString())}
              </span>
            </div>
            <h1 className="font-sans text-2xl font-bold leading-tight tracking-tight">
              {form.title.trim() || (
                <span className="text-muted-foreground">(Tanpa judul)</span>
              )}
            </h1>
            {form.excerpt && (
              <p className="text-base font-medium leading-relaxed text-muted-foreground">
                {form.excerpt}
              </p>
            )}
            {form.coverImage && (
              <img
                src={form.coverImage}
                alt={form.title || "Gambar sampul"}
                className="aspect-[16/9] w-full rounded-lg border object-cover"
              />
            )}
            <div
              className="news-content text-foreground"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(form.content) || "<p class='text-muted-foreground italic'>Belum ada konten.</p>",
              }}
            />
          </article>
        ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Judul berita"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEWS_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as "DRAFT" | "PUBLISHED" })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Ringkasan</Label>
            <Textarea
              id="excerpt"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Cuplikan singkat berita…"
              rows={2}
            />
          </div>

          <ImageUpload
            label="Gambar Sampul"
            aspect="video"
            value={form.coverImage}
            onChange={(url) => setForm({ ...form, coverImage: url })}
            helperText="Rasio 16:9 disarankan."
          />

          {/* remount on dialog open to reset contentEditable content */}
          {open && (
            <RichTextEditor
              key={editing?.id ?? "new"}
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
            />
          )}
        </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Menyimpan…
              </>
            ) : (
              <>
                <Save className="size-4" /> Simpan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
