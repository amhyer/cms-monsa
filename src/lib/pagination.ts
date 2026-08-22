/**
 * Cursor-based pagination utilities.
 * Cursor di-encode sebagai base64 untuk URL safety dan disembunyikan dari client.
 */

/** Encode cursor value to opaque string */
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString("base64url");
}

/** Decode opaque cursor string back to original ID, returns null if invalid */
export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, "base64url").toString();
  } catch {
    return null;
  }
}

/** Standard pagination parameters extracted from URL search params */
export interface PaginationParams {
  cursor: string | null;
  limit: number;
}

/** Parse pagination params from request URL */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): PaginationParams {
  const cursor = searchParams.get("cursor");
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number(searchParams.get("limit") || String(defaultLimit)))
  );
  return { cursor, limit };
}

/** Response shape for cursor-based pagination */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
  hasMore: boolean;
}

/** Build paginated response */
export function buildPaginatedResponse<T extends { id: string }>(
  items: T[],
  total: number,
  limit: number
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  // If we fetched one extra item, we know there's more
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && trimmed.length > 0
      ? encodeCursor(trimmed[trimmed.length - 1].id)
      : null;

  return {
    items: trimmed,
    nextCursor,
    total,
    hasMore,
  };
}
