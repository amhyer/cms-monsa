"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
  className?: string;
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  center,
  className,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        center && "items-center text-center",
        className
      )}
    >
      {eyebrow && (
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-foreground">
          <span className="h-px w-6 bg-gold" />
          {eyebrow}
        </span>
      )}
      <h2 className="font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "max-w-2xl text-sm text-muted-foreground sm:text-base",
            center && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
