"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Quote, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Testimonial {
  id: string;
  parentName: string;
  studentName: string | null;
  className: string | null;
  relation: string | null;
  content: string;
  rating: number | null;
  photoUrl: string | null;
  createdAt: string;
}

interface ParentTestimonialsProps {
  limit?: number;
  showForm?: boolean;
}

export function ParentTestimonials({ limit = 6, showForm = true }: ParentTestimonialsProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [relation, setRelation] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const fetchTestimonials = useCallback(async () => {
    try {
      const res = await fetch(`/api/testimonials?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setTestimonials(data.testimonials || []);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  async function handleSubmit() {
    if (!parentName.trim() || !content.trim()) {
      toast.error("Nama dan testimoni wajib diisi!");
      return;
    }

    if (rating === 0) {
      toast.error("Pilih rating terlebih dahulu!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName,
          studentName,
          className,
          relation,
          content,
          rating,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim testimoni");

      toast.success(data.message || "Testimoni berhasil dikirim!");
      setShowSubmitForm(false);
      setParentName("");
      setStudentName("");
      setClassName("");
      setRelation("");
      setContent("");
      setRating(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim testimoni");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (testimonials.length === 0 && !showForm) {
    return null;
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Quote className="size-4 text-primary" /> Testimoni Orang Tua
        </h2>
        {showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSubmitForm(!showSubmitForm)}
          >
            {showSubmitForm ? "Tutup" : "Kirim Testimoni"}
          </Button>
        )}
      </div>

      {/* Submit Form */}
      {showSubmitForm && (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nama Orang Tua *"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
            />
            <Input
              placeholder="Nama Siswa"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <Input
              placeholder="Kelas"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            />
            <Input
              placeholder="Hubungan (Ayah/Ibu/Wali)"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Rating *</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star
                    className={`size-6 ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Textarea
            placeholder="Tuliskan testimoni Anda... *"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Mengirim..." : <><Send className="mr-2 size-4" /> Kirim</>}
          </Button>
        </div>
      )}

      {/* Testimonials Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="relative rounded-lg border bg-background p-4"
          >
            <Quote className="absolute right-4 top-4 size-8 text-primary/10" />
            
            {/* Rating */}
            {testimonial.rating && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-4 ${
                      star <= testimonial.rating!
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Content */}
            <p className="mt-3 text-sm text-muted-foreground">
              "{testimonial.content}"
            </p>

            {/* Author */}
            <div className="mt-4 flex items-center gap-3">
              {testimonial.photoUrl ? (
                <img
                  src={testimonial.photoUrl}
                  alt={testimonial.parentName}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <User className="size-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{testimonial.parentName}</p>
                <p className="text-xs text-muted-foreground">
                  {testimonial.relation && `${testimonial.relation} `}
                  {testimonial.studentName && `dari ${testimonial.studentName}`}
                  {testimonial.className && ` (${testimonial.className})`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
