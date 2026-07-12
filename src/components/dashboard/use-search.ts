"use client";

import { useMemo, useState } from "react";

/**
 * Simple client-side search filter for dashboard tables.
 * Returns the search value, setter, and a filtered list.
 *
 * Usage:
 *   const { search, setSearch, filtered } = useSearch(items, (item) =>
 *     `${item.name} ${item.email}`.toLowerCase()
 *   );
 */
export function useSearch<T>(
  items: T[],
  getSearchableText: (item: T) => string
) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      getSearchableText(item).toLowerCase().includes(q)
    );
  }, [items, search, getSearchableText]);

  return { search, setSearch, filtered };
}
