import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Salin objek tanpa kolom tertentu — dipakai untuk menyaring data sensitif
 * (mis. NUPTK/NIP/NIK) dari respons API publik. Kolom tetap dibaca dari DB
 * tapi tidak pernah keluar dari server.
 */
export function omitFields<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[]
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const k of keys) delete out[k];
  return out as T;
}
