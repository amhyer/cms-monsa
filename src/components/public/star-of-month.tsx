"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Award, GraduationCap, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StarOfMonth {
  id: string;
  type: string;
  month: number;
  year: number;
  reason: string;
  achievement: string | null;
  photoUrl: string | null;
  student: {
    id: string;
    name: string;
    photoUrl: string | null;
    class: { name: string } | null;
  } | null;
  teacher: {
    id: string;
    name: string;
    photo: string | null;
    position: string;
  } | null;
}

interface StarOfMonthProps {
  type?: "STUDENT" | "TEACHER";
}

export function StarOfMonth({ type }: StarOfMonthProps) {
  const [stars, setStars] = useState<StarOfMonth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStars = useCallback(async () => {
    try {
      const url = type ? `/api/star-of-month?type=${type}` : "/api/star-of-month";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStars(data.stars || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchStars();
  }, [fetchStars]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (stars.length === 0) {
    return null;
  }

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  return (
    <section className="rounded-xl border bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-5">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold">
        <Star className="size-5 text-yellow-500" /> Bintang Bulanan
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stars.map((star) => {
          const isStudent = star.type === "STUDENT";
          const person = isStudent ? star.student : star.teacher;
          const Icon = isStudent ? GraduationCap : User;

          return (
            <div
              key={star.id}
              className="relative overflow-hidden rounded-xl border bg-background p-4"
            >
              {/* Background decoration */}
              <div className="absolute -right-4 -top-4 size-24 rounded-full bg-yellow-500/10" />
              
              <div className="relative flex items-start gap-4">
                {/* Photo */}
                {person && (("photoUrl" in person && person.photoUrl) || ("photo" in person && person.photo)) ? (
                  <img
                    src={("photoUrl" in person && person.photoUrl) || ("photo" in person && person.photo) || ""}
                    alt={person.name}
                    className="size-16 shrink-0 rounded-full border-2 border-yellow-500 object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-yellow-500 bg-yellow-500/10">
                    <Icon className="size-8 text-yellow-500" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500 text-white">
                      <Star className="mr-1 size-3" />
                      {isStudent ? "Siswa" : "Guru"} Terbaik
                    </Badge>
                  </div>
                  
                  <h3 className="mt-2 text-lg font-bold">
                    {person?.name || "N/A"}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground">
                    {isStudent && star.student?.class
                      ? `Kelas ${star.student.class.name}`
                      : star.teacher?.position || ""}
                  </p>
                  
                  <p className="mt-2 text-sm">{star.reason}</p>
                  
                  {star.achievement && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Award className="mr-1 inline size-3" />
                      {star.achievement}
                    </p>
                  )}
                  
                  <p className="mt-2 text-xs text-muted-foreground">
                    {monthNames[star.month - 1]} {star.year}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
