"use client";

import { useState, useEffect } from "react";
import { Star, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Rating {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
}

interface TeacherRatingProps {
  teacherId: string;
}

export function TeacherRating({ teacherId }: TeacherRatingProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [authorName, setAuthorName] = useState("");

  useEffect(() => {
    fetchRatings();
  }, [teacherId]);

  async function fetchRatings() {
    try {
      const res = await fetch(`/api/teachers/${teacherId}/ratings?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setRatings(data.ratings || []);
        setAverageRating(data.averageRating || 0);
        setTotalRatings(data.totalRatings || 0);
      }
    } catch {
      // Ignore error
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Pilih rating terlebih dahulu!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, authorName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim rating");

      toast.success(data.message || "Rating berhasil dikirim!");
      setShowForm(false);
      setRating(0);
      setComment("");
      setAuthorName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim rating");
    } finally {
      setSubmitting(false);
    }
  }

  function renderStars(size: "sm" | "md" = "md") {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => {
              setRating(star);
              setShowForm(true);
            }}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="focus:outline-none"
          >
            <Star
              className={`${size === "sm" ? "size-4" : "size-5"} ${
                star <= (hoverRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-gray-200 text-gray-200"
              } transition-colors`}
            />
          </button>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold">
          <Star className="size-4 text-yellow-500" /> Rating & Review
        </h2>
        {totalRatings > 0 && (
          <Badge variant="secondary">
            {totalRatings} {totalRatings === 1 ? "review" : "reviews"}
          </Badge>
        )}
      </div>

      {/* Average Rating */}
      {totalRatings > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl font-bold text-yellow-500">
            {averageRating.toFixed(1)}
          </span>
          <div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`size-4 ${
                    star <= Math.round(averageRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-gray-200 text-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              dari {totalRatings} {totalRatings === 1 ? "review" : "reviews"}
            </p>
          </div>
        </div>
      )}

      {/* Rate Button */}
      {!showForm && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 gap-1"
          onClick={() => setShowForm(true)}
        >
          <MessageSquare className="size-3" /> Beri Rating
        </Button>
      )}

      {/* Rating Form */}
      {showForm && (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/50 p-4">
          <div>
            <p className="mb-2 text-sm font-medium">Rating Anda</p>
            {renderStars("md")}
          </div>
          <Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Nama Anda (opsional, bisa anonim)"
            className="max-w-xs"
          />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tulis review Anda... (opsional)"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
            >
              {submitting ? (
                "Mengirim..."
              ) : (
                <>
                  <Send className="size-3 mr-1" /> Kirim
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setRating(0);
                setComment("");
                setAuthorName("");
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {ratings.length > 0 && (
        <div className="mt-4 space-y-3">
          {ratings.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {r.authorName || "Anonim"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-3 ${
                          star <= r.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              {r.comment && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {ratings.length === 0 && !showForm && (
        <p className="mt-3 text-sm text-muted-foreground">
          Belum ada review. Jadilah yang pertama memberikan rating!
        </p>
      )}
    </section>
  );
}
