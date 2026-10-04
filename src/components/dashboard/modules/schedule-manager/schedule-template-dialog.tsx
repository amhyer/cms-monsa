"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule-templates";
import type { ClassItem } from "@/lib/types";

type ScheduleTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (id: string) => void;
  templateClassId: string;
  onTemplateClassIdChange: (id: string) => void;
  classes: ClassItem[];
  importing: boolean;
  onImport: () => void;
};

export function ScheduleTemplateDialog({
  open,
  onOpenChange,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  templateClassId,
  onTemplateClassIdChange,
  classes,
  importing,
  onImport,
}: ScheduleTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Template Jadwal</DialogTitle>
          <DialogDescription>
            Pilih template standar SD. Slot yang sudah terisi tidak akan ditimpa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={onSelectedTemplateIdChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEDULE_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const tpl = SCHEDULE_TEMPLATES.find((t) => t.id === selectedTemplateId);
              return tpl ? (
                <p className="text-xs text-muted-foreground">{tpl.description} · {tpl.entries.length} slot</p>
              ) : null;
            })()}
          </div>
          <div className="space-y-2">
            <Label>Target Kelas (opsional)</Label>
            <Select value={templateClassId || "none"} onValueChange={(v) => onTemplateClassIdChange(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Tanpa kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Semua Kelas —</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Batal</Button>
          <Button onClick={onImport} disabled={importing}>
            {importing ? <><Loader2 className="size-4 animate-spin" /> Mengimport…</> : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
