/**
 * Set Cache-Control header on a NextResponse.
 *
 * Usage:
 *   return withCache(NextResponse.json({ items }), "public, s-maxage=300, stale-while-revalidate=600");
 *   return withCache(NextResponse.json({ items }), scope === "public" ? "public, s-maxage=120, stale-while-revalidate=300" : "");
 */
export function withCache<T extends Response>(res: T, directives: string): T {
  if (directives) res.headers.set("Cache-Control", directives);
  return res;
}
