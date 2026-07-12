"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { exportToCsv } from "@/lib/export";
import type { ActivityLogItem } from "@/lib/types";
import {
  PageLoader,
  EmptyState,
  actionBadgeClass,
  actionLabel,
} from "../_shared";

const ENTITY_OPTIONS = [
  { value: "all", label: "Semua Entitas" },
  { value: "News", label: "Berita" },
  { value: "Announcement", label: "Pengumuman" },
  { value: "Agenda", label: "Agenda" },
  { value: "Teacher", label: "Guru & Staf" },
  { value: "Gallery", label: "Galeri" },
  { value: "Achievement", label: "Prestasi" },
  { value: "User", label: "Pengguna" },
  { value: "SiteSetting", label: "Pengaturan" },
  { value: "Auth", label: "Autentikasi" },
];

const PAGE_SIZE = 20;

export function LogsView() {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(page),
      });
      if (entity !== "all") qs.set("entity", entity);
      const res = await fetch(`/api/activity-logs?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error("Anda tidak memiliki akses ke log aktivitas.");
        }
        throw new Error();
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [entity, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Reset to page 1 when filter changes.
  useEffect(() => {
    setPage(1);
  }, [entity]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ScrollText className="size-5 text-gold-foreground" />
          Log Aktivitas
        </h2>
        <p className="text-sm text-muted-foreground">
          Catatan ini merekam semua aktivitas Create/Update/Delete oleh operator
          & admin.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter entitas:</span>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                exportToCsv(
                  `log-aktivitas-${new Date().toISOString().slice(0, 10)}`,
                  items,
                  [
                    { key: "createdAt", label: "Waktu" },
                    { key: "userName", label: "Pengguna" },
                    { key: "action", label: "Aksi" },
                    { key: "entity", label: "Entitas" },
                    { key: "detail", label: "Detail" },
                  ]
                );
                toast.success("Log aktivitas diekspor ke CSV.");
              }}
              disabled={items.length === 0}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </div>

          {loading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Belum ada log"
              description="Aktivitas Create/Update/Delete akan tampil di sini."
            />
          ) : (
            <div className="rounded-md border">
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Pengguna</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Entitas</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {log.userName}
                        </TableCell>
                        <TableCell>
                          <Badge className={actionBadgeClass(log.action)}>
                            {actionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">{log.entity}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} dari {total} log
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="size-4" /> Sebelumnya
                </Button>
                <span className="text-sm text-muted-foreground">
                  Halaman {page} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Berikutnya <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LogsView;
