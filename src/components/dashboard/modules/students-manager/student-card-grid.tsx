"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserCircle2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyableId } from "@/components/shared/copyable-id";
import type { ClassItem, StudentItem } from "@/lib/types";

type StudentCardGridProps = {
  items: StudentItem[];
  classes: ClassItem[];
  onEdit: (s: StudentItem) => void;
  onDelete: (s: StudentItem) => void;
};

export function StudentCardGrid({ items, classes, onEdit, onDelete }: StudentCardGridProps) {
  const router = useRouter();

  const classNameOf = (classId: string) =>
    classes.find((c) => c.id === classId)?.name ?? "—";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex items-start gap-3 py-4">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
              {s.photoUrl ? (
                <img
                  src={s.photoUrl}
                  alt={s.name}
                  className="size-full object-cover"
                />
              ) : (
                <UserCircle2 className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="line-clamp-1 font-semibold">{s.name}</h3>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onEdit(s)}
                    aria-label="Edit siswa"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="Hapus siswa"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                    title="Hapus Data Siswa"
                    description={`Hapus data "${s.name}" (NIS ${s.nis})? Data kehadiran dan pembayaran siswa ini juga akan terhapus.`}
                    confirmText="Hapus"
                    onConfirm={() => onDelete(s)}
                  />
                </div>
              </div>
              <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                <CopyableId label="NIS" value={s.nis} />
                {s.nisn && <CopyableId label="NISN" value={s.nisn} />}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">{classNameOf(s.classId)}</Badge>
                {s.gender && <Badge variant="outline">{s.gender === "LAKI_LAKI" ? "Laki-laki" : s.gender === "PEREMPUAN" ? "Perempuan" : s.gender}</Badge>}
                {s.isActive ? (
                  <Badge className="bg-emerald-600 text-white">Aktif</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
                )}
              </div>
              {(s.parentName || s.parentPhone) && (
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {s.parentName ? `Ortu: ${s.parentName}` : ""}
                  {s.parentPhone ? ` • ${s.parentPhone}` : ""}
                </p>
              )}
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() =>
                    router.push(
                      `/dashboard/users?createSiswa=${encodeURIComponent(
                        s.id
                      )}&studentName=${encodeURIComponent(s.name)}`
                    )
                  }
                  aria-label={`Buat akun SISWA untuk ${s.name}`}
                >
                  <UserPlus className="size-3.5" />
                  Buat akun SISWA
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
