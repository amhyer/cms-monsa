/**
 * Terjemahkan error menjadi body JSON yang aman.
 * Tidak pernah membocorkan stack trace, DSN, token, atau kunci pairing —
 * hanya pesan validasi yang memang ditulis untuk operator, atau pesan
 * generik + kode Prisma untuk error internal.
 */
export function describeIngestError(err: unknown): { error: string; code?: string } {
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : "";

  // P2028 = interactive transaction kedaluwarsa / tidak ditemukan.
  if (code === "P2028" || /Transaction (not found|already closed)/i.test(message)) {
    return {
      error:
        "Sinkronisasi melebihi batas waktu transaksi database. Data yang belum " +
        "tersimpan sudah dibatalkan (rollback) dan tidak ada data yang dihapus. " +
        "Silakan coba \u201cTarik & Kirim\u201d sekali lagi.",
      code: "P2028",
    };
  }

  if (code === "P2024") {
    return {
      error:
        "Database sedang sibuk sehingga koneksi tidak tersedia. Silakan coba lagi beberapa saat.",
      code: "P2024",
    };
  }

  if (isValidationMessage(message)) {
    return { error: message };
  }

  if (typeof code === "string" && /^P\d{4}$/.test(code)) {
    return { error: "Gagal menyimpan data Dapodik ke database.", code };
  }

  // Pesan buatan sendiri dari runSync/normalize aman ditampilkan.
  if (message && message.length <= 400 && !/\n/.test(message)) {
    return { error: message };
  }

  return { error: "Gagal memproses data Dapodik." };
}

function isValidationMessage(message: string): boolean {
  return /wajib|tidak valid|Terlalu banyak/i.test(message);
}

export function ingestErrorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : "";
  const code = (err as { code?: string } | null)?.code;
  if (!code && isValidationMessage(message)) return 400;
  if (code === "P2028" || code === "P2024") return 503;
  return 502;
}
