"use client";

import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tailwind class for an activity-log action badge. */
export function actionBadgeClass(action: string): string {
  switch (action) {
    case "CREATE":
      return "bg-emerald-600 text-white";
    case "UPDATE":
      return "bg-primary text-primary-foreground";
    case "DELETE":
      return "bg-destructive text-white";
    case "LOGIN":
    case "LOGOUT":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case "CREATE":
      return "Buat";
    case "UPDATE":
      return "Ubah";
    case "DELETE":
      return "Hapus";
    case "LOGIN":
      return "Masuk";
    case "LOGOUT":
      return "Keluar";
    default:
      return action;
  }
}

export function PageLoader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  icon?: typeof Inbox;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

/** Map a JS Date or ISO string to a yyyy-mm-dd value for <input type="date">. */
export function toDateInputValue(
  date: string | null | undefined
): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a yyyy-mm-dd value into an ISO string (preserving local day). */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
