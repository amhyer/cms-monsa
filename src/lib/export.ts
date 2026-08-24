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

/**
 * Export announcements to PDF using jsPDF.
 * Generates a downloadable PDF file with formatted announcement content.
 */
export async function exportAnnouncementsToPdf(
  items: { title: string; content: string; createdAt: string; isPinned: boolean; isActive: boolean }[]
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper: check if we need a new page
  const checkNewPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Pengumuman Sekolah", pageWidth / 2, y, { align: "center" });
  y += 10;

  // Subtitle with date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128);
  const printDate = new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Dicetak: ${printDate}`, pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setTextColor(0);

  // Separator line
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Items
  for (const item of items) {
    checkNewPage(40);

    // Card background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y - 2, contentWidth, 6, 1, 1, "F");

    // Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    const titleLines = doc.splitTextToSize(item.title, contentWidth - 4);
    doc.text(titleLines, margin + 2, y + 3);
    y += 3 + titleLines.length * 5;

    // Meta line
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    const created = new Date(item.createdAt).toLocaleDateString("id-ID");
    const badges = [created];
    if (item.isPinned) badges.push("Disematkan");
    if (!item.isActive) badges.push("Nonaktif");
    doc.text(badges.join(" | "), margin + 2, y + 3);
    y += 6;

    // Content (strip HTML tags for PDF)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    const plain = item.content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const contentLines = doc.splitTextToSize(plain || "—", contentWidth - 4);
    // Limit to ~8 lines per item to avoid overflow
    const maxLines = contentLines.slice(0, 8);
    doc.text(maxLines, margin + 2, y + 3);
    y += 3 + maxLines.length * 4.5 + 6;

    // Bottom border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
    y += 2;
  }

  // Footer
  checkNewPage(15);
  y = pageHeight - margin;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175);
  doc.text(
    "CMS MONSA — UPT SPF SD Negeri Unggulan Mongisidi 1",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // Save
  doc.save("pengumuman-sekolah.pdf");
}

/**
 * Export schedule grid to PDF (landscape) — matches the visual grid layout.
 * Rows = time slots, Columns = days.
 */
export async function exportScheduleToPdf(opts: {
  entries: { day: string; timeSlot: number; timeLabel: string | null; subject: string; teacherName?: string | null; roomId?: string | null }[];
  days: readonly string[];
  className: string;
  academicYear: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 12; // margin
  const headerH = 8;
  const rowH = 14;
  const labelColW = 22;
  const dayColW = (pw - m * 2 - labelColW) / opts.days.length;

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Jadwal Pelajaran", pw / 2, m + 4, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${opts.className} — TA ${opts.academicYear}`, pw / 2, m + 10, { align: "center" });
  doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, pw / 2, m + 15, { align: "center" });
  doc.setTextColor(0);

  const tableTop = m + 20;

  // Build grid map
  const grid = new Map<string, string>();
  for (const e of opts.entries) {
    const key = `${e.day}-${e.timeSlot}`;
    const lines = [e.subject];
    if (e.teacherName) lines.push(e.teacherName);
    if (e.roomId) lines.push(e.roomId);
    grid.set(key, lines.join("\n"));
  }

  // Column headers
  let x = m;
  doc.setFillColor(30, 64, 175);
  doc.rect(m, tableTop, pw - m * 2, headerH, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("Jam", x + 1, tableTop + 5.5);
  x += labelColW;
  for (const day of opts.days) {
    doc.text(day, x + dayColW / 2, tableTop + 5.5, { align: "center" });
    x += dayColW;
  }
  doc.setTextColor(0);

  // Determine max slot
  const maxSlot = Math.max(7, ...opts.entries.map((e) => e.timeSlot));

  // Rows
  let y = tableTop + headerH;
  for (let slot = 1; slot <= maxSlot; slot++) {
    if (y + rowH > ph - m) {
      doc.addPage();
      y = m;
    }
    const fill = slot % 2 === 0;
    if (fill) {
      doc.setFillColor(243, 244, 246);
      doc.rect(m, y, pw - m * 2, rowH, "F");
    }

    x = m;
    // Slot label
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Jam ${slot}`, x + 1, y + 5.5);
    // Time label from first matching entry
    const firstEntry = opts.entries.find((e) => e.timeSlot === slot && e.timeLabel);
    if (firstEntry?.timeLabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120);
      doc.text(firstEntry.timeLabel, x + 1, y + 10);
      doc.setTextColor(0);
    }

    x += labelColW;
    for (const day of opts.days) {
      const text = grid.get(`${day}-${slot}`);
      if (text) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const lines = text.split("\n");
        doc.text(lines[0], x + 1, y + 5.5, { maxWidth: dayColW - 2 });
        if (lines.length > 1) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(80);
          doc.text(lines.slice(1).join(", "), x + 1, y + 10, { maxWidth: dayColW - 2 });
          doc.setTextColor(0);
        }
      }
      // Cell border
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.rect(x, y, dayColW, rowH);
      x += dayColW;
    }
    // Label column border
    doc.setDrawColor(200);
    doc.rect(m, y, labelColW, rowH);
    y += rowH;
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156);
  doc.text("CMS MONSA — UPT SPF SD Negeri Unggulan Mongisidi 1", pw / 2, ph - 6, { align: "center" });

  const safe = opts.className.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  doc.save(`jadwal-${safe}-${opts.academicYear}.pdf`);
}
