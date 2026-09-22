"use client";

import { Loader2, Newspaper, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { NewsItem } from "@/lib/types";

type NewsTableProps = {
  items: NewsItem[];
  selected: Set<string>;
  bulkDeleting: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onEdit: (n: NewsItem) => void;
  onDelete: (n: NewsItem) => void;
};

export function NewsTable({
  items,
  selected,
  bulkDeleting,
  onToggleSelect,
  onToggleSelectAll,
  onClearSelection,
  onBulkDelete,
  onEdit,
  onDelete,
}: NewsTableProps) {
  return (
    <div className="rounded-md border">
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} berita dipilih
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onBulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Hapus Terpilih
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            Batal
          </Button>
        </div>
      )}
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    items.length > 0 && selected.size === items.length
                  }
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Pilih semua berita"
                />
              </TableHead>
              <TableHead className="min-w-[220px]">Judul</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Penulis</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((n) => (
            <TableRow key={n.id} data-selected={selected.has(n.id)}>
              <TableCell>
                <Checkbox
                  checked={selected.has(n.id)}
                  onCheckedChange={() => onToggleSelect(n.id)}
                  aria-label={`Pilih ${n.title}`}
                />
              </TableCell>
              <TableCell className="max-w-[280px]">
                <div className="flex items-center gap-3">
                  {n.coverImage ? (
                    <img
                      src={n.coverImage}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Newspaper className="size-4" />
                    </div>
                  )}
                  <span className="line-clamp-2 font-medium">{n.title}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{n.category}</Badge>
              </TableCell>
              <TableCell>
                {n.status === "PUBLISHED" ? (
                  <Badge className="bg-emerald-600 text-white">Published</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Draft</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {n.authorName ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(n.publishedAt || n.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(n)}
                    aria-label="Edit berita"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label="Hapus berita"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title="Hapus Berita"
                    description={`Hapus "${n.title}"? Tindakan ini tidak dapat dibatalkan.`}
                    confirmText="Hapus"
                    onConfirm={() => onDelete(n)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
