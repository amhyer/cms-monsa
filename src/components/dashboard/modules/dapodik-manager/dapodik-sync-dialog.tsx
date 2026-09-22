"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SyncPreview } from "./types";

export function DapodikSyncDialog({
  open,
  onOpenChange,
  syncPreview,
  syncing,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncPreview: SyncPreview | null;
  syncing: boolean;
  onCommit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Konfirmasi Sinkronisasi</DialogTitle>
          <DialogDescription>
            Review perubahan yang akan dilakukan ke database.
          </DialogDescription>
        </DialogHeader>
        {syncPreview && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Sekolah</p>
                <p className="font-medium">Update: {syncPreview.sekolah.updated}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Rombel</p>
                <p className="font-medium">
                  Baru: {syncPreview.rombel.created} · Update: {syncPreview.rombel.updated}
                </p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Siswa</p>
                <p className="font-medium">
                  Baru: {syncPreview.siswa.created} · Update: {syncPreview.siswa.updated} · Arsip: {syncPreview.siswa.archived}
                </p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">GTK / Guru</p>
                <p className="font-medium">
                  Baru: {syncPreview.gtk.created} · Update: {syncPreview.gtk.updated} · Arsip: {syncPreview.gtk.archived}
                </p>
              </div>
            </div>
            {(syncPreview.siswa.archived > 0 || syncPreview.gtk.archived > 0) && (
              <p className="text-xs text-amber-600">
                Data yang diarsipkan tidak akan muncul di daftar aktif, tapi riwayat kehadiran/pembayarannya tetap aman.
              </p>
            )}
            {(syncPreview.siswa.errors > 0 || syncPreview.gtk.errors > 0) && (
              <p className="text-xs text-destructive">
                {syncPreview.siswa.errors > 0
                  ? `${syncPreview.siswa.errors} siswa dilewati (rombel tidak ditemukan). `
                  : ""}
                {syncPreview.gtk.errors > 0
                  ? `${syncPreview.gtk.errors} GTK dilewati (tanpa NUPTK/NIP).`
                  : ""}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={onCommit} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Lanjutkan Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
