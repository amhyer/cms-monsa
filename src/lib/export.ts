/**
 * Trigger a CSV download in the browser from an array of row objects.
 * - Headers taken from `columns` (preserves order).
 * - Values are escaped: quotes doubled, wrapped in quotes if needed.
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
) {
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r;]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(row[c.key])).join(","))
    .join("\n");

  // Prepend BOM so Excel reads UTF-8 correctly (e.g. for Indonesian text).
  const csv = "\uFEFF" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
