/**
 * Pemisah teks untuk highlight substring hasil pencarian (case-insensitive,
 * semua kemunculan). Murni tanpa React agar bisa diuji unit langsung.
 */

export type MatchPart = { text: string; match: boolean };

/**
 * Pecah `text` menjadi bagian-bagian, menandai bagian yang cocok dengan
 * `query` (case-insensitive). Query kosong / tanpa kecocokan → satu bagian
 * utuh tanpa match.
 */
export function splitMatches(text: string, query: string): MatchPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  const parts: MatchPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx), match: false });
    parts.push({ text: m[0], match: true });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
