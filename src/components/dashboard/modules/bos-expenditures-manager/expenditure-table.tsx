"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatCurrency } from "@/lib/format";
import type { BosExpenditureItem } from "@/lib/types";
import { CursorPagination } from "../../_shared";

type ExpenditureTableProps = {
  items: BosExpenditureItem[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onEdit: (item: BosExpenditureItem) => void;
  onDelete: (item: BosExpenditureItem) => void;
};

export function ExpenditureTable({
  items,
  loading,
  total,
  page,
  totalPages,
  canGoBack,
  canGoForward,
  onPrev,
  onNext,
  pageSize,
  onPageSizeChange,
  onEdit,
  onDelete,
}: ExpenditureTableProps) {
  return (
    <>
      <div className="rounded-md border">
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun</TableHead>
                <TableHead>Sumber Dana</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Uraian Belanja</TableHead>
                <TableHead className="text-center">Triwulan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.year}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.source}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.category}
                  </TableCell>
                  <TableCell>{item.item}</TableCell>
                  <TableCell className="text-center">
                    {item.quarter ? `TW ${item.quarter}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(item)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            aria-label="Hapus"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Hapus belanja?"
                        description={`"${item.item}" (${item.year}) akan dihapus permanen.`}
                        confirmText="Hapus"
                        onConfirm={() => onDelete(item)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <CursorPagination
        page={page}
        totalPages={totalPages}
        total={total}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onPrev={onPrev}
        onNext={onNext}
        pageSize={pageSize}
        disabled={loading}
        onPageSizeChange={onPageSizeChange}
      />
    </>
  );
}
