"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Users, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  category: string;
  type: string;
  isAllDay: boolean;
  color: string | null;
  imageUrl: string | null;
  maxParticipants: number | null;
  requiresRegistration: boolean;
  registrationCount: number;
}

interface SchoolEventsCalendarProps {
  limit?: number;
  showCalendar?: boolean;
}

const categoryConfig: Record<string, { color: string; bgColor: string }> = {
  "Akademik": { color: "text-blue-600", bgColor: "bg-blue-100" },
  "Ekstrakurikuler": { color: "text-green-600", bgColor: "bg-green-100" },
  "Upacara": { color: "text-red-600", bgColor: "bg-red-100" },
  "Perlombaan": { color: "text-yellow-600", bgColor: "bg-yellow-100" },
  "Kunjungan": { color: "text-purple-600", bgColor: "bg-purple-100" },
};

export function SchoolEventsCalendar({ limit = 10, showCalendar = true }: SchoolEventsCalendarProps) {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const fetchEvents = useCallback(async () => {
    try {
      const month = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/events?limit=${limit}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }, [currentMonth, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }

  // Generate calendar days
  function generateCalendarDays(): (number | null)[] {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }

  function getEventsForDay(day: number) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold">
        <Calendar className="size-4 text-primary" /> Kalender Event Sekolah
      </h2>

      {/* Calendar Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="font-semibold">
          {currentMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        </h3>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      {showCalendar && (
        <div className="mt-4 grid grid-cols-7 gap-1">
          {/* Day headers */}
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
            <div key={day} className="py-1 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {generateCalendarDays().map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-12" />;
            }

            const dayEvents = getEventsForDay(day);
            const isToday =
              day === new Date().getDate() &&
              currentMonth.getMonth() === new Date().getMonth() &&
              currentMonth.getFullYear() === new Date().getFullYear();

            return (
              <div
                key={day}
                className={`relative h-12 rounded border p-1 ${
                  isToday ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <span className={`text-xs ${isToday ? "font-bold text-primary" : ""}`}>
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 flex gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => {
                      const config = categoryConfig[event.category] || categoryConfig["Akademik"];
                      return (
                        <div
                          key={event.id}
                          className={`h-1.5 flex-1 rounded-full ${config.bgColor}`}
                          title={event.title}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Events List */}
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Tidak ada event bulan ini.
          </p>
        ) : (
          events.map((event) => {
            const config = categoryConfig[event.category] || categoryConfig["Akademik"];
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border bg-background p-3"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                  <Calendar className={`size-5 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{event.title}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {event.category}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(event.startDate).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {!event.isAllDay && (
                        <>
                          {" "}
                          {new Date(event.startDate).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {event.location}
                      </span>
                    )}
                    {event.maxParticipants && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {event.registrationCount}/{event.maxParticipants}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
