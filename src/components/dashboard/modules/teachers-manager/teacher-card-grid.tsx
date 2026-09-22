"use client";

import { Eye, Pencil, Trash2, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyableId } from "@/components/shared/copyable-id";
import type { TeacherItem } from "@/lib/types";

type TeacherCardGridProps = {
  items: TeacherItem[];
  onPreview: (teacher: TeacherItem) => void;
  onEdit: (teacher: TeacherItem) => void;
  onDelete: (teacher: TeacherItem) => void;
};

export function TeacherCardGrid({
  items,
  onPreview,
  onEdit,
  onDelete,
}: TeacherCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex items-start gap-3 py-4">
            <button
              type="button"
              onClick={() => onPreview(t)}
              aria-label={`Lihat profil ${t.name}`}
              className="size-14 shrink-0 cursor-pointer overflow-hidden rounded-full bg-muted transition hover:ring-2 hover:ring-gold"
            >
              {t.photo ? (
                <img
                  src={t.photo}
                  alt={t.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <UserCircle2 className="size-8" />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(t)}
                  className="line-clamp-1 cursor-pointer text-left font-semibold transition hover:text-gold"
                >
                  {t.name}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onPreview(t)}
                    aria-label="Lihat profil"
                    title="Lihat profil"
                  >
                    <Eye className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onEdit(t)}
                    aria-label="Edit guru"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="Hapus guru"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Hapus Data Guru"
                    description={`Hapus data "${t.name}"?`}
                    confirmText="Hapus"
                    onConfirm={() => onDelete(t)}
                  />
                </div>
              </div>
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {t.position || "—"}
              </p>
              {(t.nuptk || t.nip || t.nik) && (
                <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                  {t.nuptk && <CopyableId label="NUPTK" value={t.nuptk} />}
                  {t.nip && <CopyableId label="NIP" value={t.nip} />}
                  {t.nik && <CopyableId label="NIK" value={t.nik} />}
                </div>
              )}
              {String(t.position).toLowerCase().includes("kepala sekolah") && (
                <Badge className="mt-1 bg-gold text-gold-foreground">Kepala Sekolah</Badge>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {t.subject && <Badge variant="outline">{t.subject}</Badge>}
                {t.isActive ? (
                  <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">
                    Nonaktif
                  </Badge>
                )}
              </div>
              {t.education && (
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {t.education}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
