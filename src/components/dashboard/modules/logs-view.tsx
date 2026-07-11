"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, Filter } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
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

export function LogsView() {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<string>("all");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "100" });
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
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

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
            <div className="max-h-[65vh] overflow-y-auto custom-scroll rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LogsView;
