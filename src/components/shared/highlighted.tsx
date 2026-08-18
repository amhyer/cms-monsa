"use client";

import { cn } from "@/lib/utils";
import { splitMatches } from "@/lib/highlight";

/**
 * Render `text` dengan bagian yang cocok dengan `query` dibungkus <mark>
 * (highlight visual). Query kosong → teks polos. Cocok untuk sel tabel /
 * kartu hasil pencarian di semua manager dashboard.
 */
export function Highlighted({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  return (
    <>
      {splitMatches(text, query).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className={cn(
              "rounded-sm bg-gold/30 px-0.5 text-inherit",
              className
            )}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
