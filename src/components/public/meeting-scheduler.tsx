"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, User, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface MeetingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface MeetingSchedulerProps {
  teacherId: string;
  teacherName: string;
}

export function MeetingScheduler({ teacherId, teacherName }: MeetingSchedulerProps) {
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MeetingSlot | null>(null);

  // Form state
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`/api/teachers/${teacherId}/meeting-slots`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  async function handleBooking() {
    if (!selectedSlot || !parentName.trim() || !studentName.trim()) {
      toast.error("Lengkapi semua data yang diperlukan!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          parentName: parentName.trim(),
          studentName: studentName.trim(),
          phone: phone.trim(),
          purpose: purpose.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menjadwalkan pertemuan");

      toast.success("Pertemuan berhasil dijadwalkan! Guru akan mengonfirmasi.");
      setShowForm(false);
      setSelectedSlot(null);
      setParentName("");
      setStudentName("");
      setPhone("");
      setPurpose("");
      fetchSlots(); // Refresh slots
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menjadwalkan pertemuan");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return null;
  }

  const availableSlots = slots.filter((s) => s.isAvailable);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Calendar className="size-4 text-primary" /> Jadwalkan Pertemuan
        </h2>
        {availableSlots.length > 0 && (
          <Badge variant="secondary">
            {availableSlots.length} slot tersedia
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Jadwalkan pertemuan dengan {teacherName} untuk konsultasi.
      </p>

      {/* Available Slots */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slots.slice(0, 6).map((slot) => (
          <button
            key={slot.id}
            type="button"
            disabled={!slot.isAvailable}
            onClick={() => {
              setSelectedSlot(slot);
              setShowForm(true);
            }}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
              slot.isAvailable
                ? "hover:border-primary hover:bg-primary/5 cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            } ${selectedSlot?.id === slot.id ? "border-primary bg-primary/10" : ""}`}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {new Date(slot.date).toLocaleDateString("id-ID", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> {slot.startTime} - {slot.endTime}
              </p>
            </div>
            {slot.isAvailable ? (
              <Badge className="bg-emerald-100 text-emerald-700">Tersedia</Badge>
            ) : (
              <Badge variant="secondary">Terisi</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Booking Form */}
      {showForm && selectedSlot && (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Jadwalkan Pertemuan</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setSelectedSlot(null);
              }}
            >
              ✕
            </Button>
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-sm font-medium">
              {new Date(selectedSlot.date).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              <Clock className="mr-1 inline size-3" />
              {selectedSlot.startTime} - {selectedSlot.endTime}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Orang Tua *</label>
              <Input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Siswa *</label>
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nama siswa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">No. HP</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812xxxx"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tujuan Pertemuan</label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Mis. Konsultasi perkembangan akademik siswa"
              rows={2}
            />
          </div>

          <Button
            onClick={handleBooking}
            disabled={submitting || !parentName.trim() || !studentName.trim()}
            className="w-full"
          >
            {submitting ? (
              "Mengirim..."
            ) : (
              <>
                <Send className="mr-1 size-3" /> Jadwalkan Pertemuan
              </>
            )}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!showForm && availableSlots.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Tidak ada slot pertemuan tersedia saat ini. Silakan hubungi guru langsung.
        </p>
      )}
    </section>
  );
}
