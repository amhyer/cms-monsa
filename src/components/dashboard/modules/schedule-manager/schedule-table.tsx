"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DAYS, type Day } from "@/lib/schedule-constants";
import type { ScheduleEntryItem } from "@/lib/types";
import { subjectColor } from "./schedule-helpers";

type ScheduleTableProps = {
  entries: ScheduleEntryItem[];
  grid: Map<string, ScheduleEntryItem>;
  slotCount: number;
  dragId: string | null;
  overCell: string | null;
  setOverCell: Dispatch<SetStateAction<string | null>>;
  setDragId: Dispatch<SetStateAction<string | null>>;
  onMoveEntry: (entryId: string, newDay: string, newSlot: number) => void;
  onOpenEdit: (entry: ScheduleEntryItem) => void;
  onOpenCreate: (day: Day, timeSlot: number) => void;
  onDelete: (entry: ScheduleEntryItem) => void;
};

export function ScheduleTable({
  entries,
  grid,
  slotCount,
  dragId,
  overCell,
  setOverCell,
  setDragId,
  onMoveEntry,
  onOpenEdit,
  onOpenCreate,
  onDelete,
}: ScheduleTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-24 border px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Jam ke-</th>
            {DAYS.map((day) => (
              <th key={day} className="border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: slotCount }, (_, i) => i + 1).map((slot) => (
            <tr key={slot}>
              <td className="border bg-muted/30 px-2 py-1 text-center font-semibold text-muted-foreground">
                <div className="text-xs">Jam {slot}</div>
                {(() => {
                  const firstEntry = entries.find((e) => e.timeSlot === slot && e.timeLabel);
                  return firstEntry?.timeLabel ? (
                    <div className="text-[10px] text-muted-foreground/70">{firstEntry.timeLabel}</div>
                  ) : null;
                })()}
              </td>
              {DAYS.map((day) => {
                const entry = grid.get(`${day}-${slot}`);
                return (
                  <td key={`${day}-${slot}`} className={`border px-1 py-1 transition ${overCell === `${day}-${slot}` && dragId ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : ""}`} onDragOver={(e) => { e.preventDefault(); setOverCell(`${day}-${slot}`); }} onDragLeave={() => setOverCell(null)} onDrop={(e) => { e.preventDefault(); setOverCell(null); setDragId(null); const id = e.dataTransfer.getData("text/plain"); if (id) onMoveEntry(id, day, slot); }}>
                    {entry ? (
                      <div
                        draggable="true"
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", entry.id); e.dataTransfer.effectAllowed = "move"; setDragId(entry.id); }}
                        onDragEnd={() => { setDragId(null); setOverCell(null); }}
                        className={`group relative flex cursor-grab flex-col rounded-md px-2 py-1.5 transition hover:ring-2 hover:ring-primary/50 ${subjectColor(entry.subject)} ${dragId === entry.id ? "opacity-40" : ""}`}
                        onClick={() => onOpenEdit(entry)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEdit(entry); } }}
                      >
                        <span className="text-xs font-semibold leading-tight line-clamp-2">{entry.subject}</span>
                        {entry.teacherName && (
                          <span className="mt-0.5 text-[10px] leading-tight opacity-75 line-clamp-1">{entry.teacherName}</span>
                        )}
                        {entry.roomId && (
                          <span className="text-[10px] leading-tight opacity-60 line-clamp-1">📍 {entry.roomId}</span>
                        )}
                        <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenEdit(entry); }} className="rounded bg-background/80 p-0.5 text-muted-foreground hover:text-foreground" aria-label="Edit jadwal">
                            <Pencil className="size-3" />
                          </button>
                          <ConfirmDialog
                            trigger={<button type="button" onClick={(e) => e.stopPropagation()} className="rounded bg-background/80 p-0.5 text-destructive hover:text-destructive" aria-label="Hapus jadwal"><Trash2 className="size-3" /></button>}
                            title="Hapus Jadwal"
                            description={`Hapus jadwal "${entry.subject}" hari ${entry.day} jam ${entry.timeSlot}?`}
                            confirmText="Hapus"
                            onConfirm={() => onDelete(entry)}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenCreate(day, slot)}
                        className="flex h-full min-h-[48px] w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 text-muted-foreground/40 transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary/60"
                        aria-label={`Tambah jadwal ${day} jam ${slot}`}
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
