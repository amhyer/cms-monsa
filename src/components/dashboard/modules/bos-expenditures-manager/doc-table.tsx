"use client";

import { FileText, Trash2, Download } from "lucide-react";
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
import { formatBytes } from "@/lib/format";
import type { BosDocumentItem } from "@/lib/types";
import { CursorPagination } from "../../_shared";

type DocTableProps = {
  docs: BosDocumentItem[];
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
  onDelete: (doc: BosDocumentItem) => void;
};

export function DocTable({
  docs,
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
  onDelete,
}: DocTableProps) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Badge variant="secondary" className="text-sm">
          {total} dokumen
        </Badge>
      </div>
      <div className="rounded-md border">
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun</TableHead>
                <TableHead>Dokumen</TableHead>
                <TableHead className="text-right">Ukuran</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.year}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {doc.title}
                        </p>
                        {doc.description && (
                          <p className="truncate text-sm text-muted-foreground">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatBytes(doc.fileSize)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Unduh dokumen"
                      >
                        <a href={`/api/bos-documents/${doc.id}`}>
                          <Download className="size-4" />
                        </a>
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
                        title="Hapus dokumen?"
                        description={`"${doc.title}" (${doc.year}) dan file PDF-nya akan dihapus permanen.`}
                        confirmText="Hapus"
                        onConfirm={() => onDelete(doc)}
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
