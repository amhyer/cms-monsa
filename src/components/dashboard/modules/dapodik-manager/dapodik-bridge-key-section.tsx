"use client";

import { Loader2, KeyRound, Unplug, Copy, Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DapodikBridgeKeyCard({
  hasBridgeToken,
  bridgePrefix,
  bridgeCreatedAt,
  generatingKey,
  revokingKey,
  onGenerate,
  onRevoke,
}: {
  hasBridgeToken: boolean;
  bridgePrefix: string | null;
  bridgeCreatedAt: string | null;
  generatingKey: boolean;
  revokingKey: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cable className="size-4" />
          Kunci Pairing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Kunci pairing menghubungkan aplikasi jembatan di PC sekolah dengan CMS ini.
          Buat kunci dan tempel di aplikasi jembatan.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={generatingKey}>
            {generatingKey ? <Loader2 className="mr-1 size-3 animate-spin" /> : <KeyRound className="mr-1 size-3" />}
            {hasBridgeToken ? "Buat ulang kunci" : "Buat kunci pairing"}
          </Button>
          {hasBridgeToken && (
            <Button variant="ghost" size="sm" onClick={onRevoke} disabled={revokingKey}>
              {revokingKey ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Unplug className="mr-1 size-3" />}
              Cabut kunci
            </Button>
          )}
        </div>
        {hasBridgeToken ? (
          <p className="text-xs text-muted-foreground">
            Kunci aktif: <span className="font-mono text-foreground">{bridgePrefix || "monsa_br_"}…</span>
            {bridgeCreatedAt
              ? ` · dibuat ${new Date(bridgeCreatedAt).toLocaleString("id-ID")}`
              : ""}
          </p>
        ) : (
          <p className="text-xs text-amber-700">
            Belum ada kunci pairing. Buat kunci, lalu tempel di aplikasi jembatan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DapodikBridgeTokenDialog({
  open,
  onOpenChange,
  plainBridgeToken,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plainBridgeToken: string | null;
  onCopy: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kunci pairing jembatan</DialogTitle>
          <DialogDescription>
            Salin kunci ini ke aplikasi jembatan di PC sekolah. Setelah jendela ditutup,
            kunci tidak ditampilkan lagi (hanya hash yang disimpan di server).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <code className="block break-all rounded-md bg-muted p-3 text-xs">{plainBridgeToken}</code>
          <p className="text-xs text-amber-700">
            Jangan bagikan kunci ini. Cabut dari dashboard jika komputer sekolah berganti atau kunci bocor.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCopy}>
            <Copy className="mr-1 size-3" />
            Salin
          </Button>
          <Button onClick={() => onOpenChange(false)}>Sudah disalin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
