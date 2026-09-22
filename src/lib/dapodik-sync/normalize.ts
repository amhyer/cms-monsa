// Normalisasi payload mentah (ingest / hasil tarik Dapodik) menjadi bentuk
// DapodikPayload yang seragam — diekstrak dari dapodik-sync.ts (P2-2).
import { normalize } from "@/lib/dapodik-sync-helpers";
import type {
  DapodikGTK,
  DapodikPayload,
  DapodikRombel,
  DapodikSekolah,
  DapodikSiswa,
} from "./types";

const MAX_INGEST_ROWS = 5000;

function asList<T>(raw: unknown): T[] {
  if (raw == null) return [];
  return (Array.isArray(raw) ? raw : [raw]) as T[];
}

const EMPTY_SCHOOL: DapodikSekolah = { nama: "", npsn: "" };

function ensureMaxRows(siswa: unknown[], gtk: unknown[], rombel: unknown[]): void {
  if (
    siswa.length > MAX_INGEST_ROWS ||
    gtk.length > MAX_INGEST_ROWS ||
    rombel.length > MAX_INGEST_ROWS
  ) {
    throw new Error(`Terlalu banyak baris (maksimal ${MAX_INGEST_ROWS} per jenis data).`);
  }
}

/**
 * Normalisasi format per-modul: { dataType, payload }.
 * Setiap modul diubah menjadi payload penuh dengan bagian lain kosong dan
 * archiveUnlisted:false (arsip parsial berbahaya — lihat commitDapodikPayload).
 * Arsip dilakukan terpisah lewat POST /api/dapodik/archive setelah semua modul.
 */
function normalizeDataTypePayload(dataType: string, p: unknown): DapodikPayload {
  switch (dataType) {
    case "sekolah": {
      const skl = (Array.isArray(p) ? asList(p)[0] : p) as DapodikSekolah | undefined;
      if (!skl || typeof skl !== "object" || Array.isArray(skl)) {
        throw new Error("Payload dataType=sekolah wajib berupa objek.");
      }
      if (!normalize(skl.nama) || !normalize(skl.npsn)) {
        throw new Error("Field sekolah.nama dan sekolah.npsn wajib diisi.");
      }
      return { sekolah: skl, siswa: [], gtk: [], rombel: [], archiveUnlisted: false };
    }
    case "gtk": {
      const gtk = asList<DapodikGTK>(p);
      ensureMaxRows([], gtk, []);
      return { sekolah: EMPTY_SCHOOL, siswa: [], gtk, rombel: [], archiveUnlisted: false };
    }
    case "rombel": {
      const rombel = asList<DapodikRombel>(p);
      ensureMaxRows([], [], rombel);
      return { sekolah: EMPTY_SCHOOL, siswa: [], gtk: [], rombel, archiveUnlisted: false };
    }
    case "peserta_didik": {
      const siswa = asList<DapodikSiswa>(p);
      ensureMaxRows(siswa, [], []);
      return { sekolah: EMPTY_SCHOOL, siswa, gtk: [], rombel: [], archiveUnlisted: false };
    }
    default:
      throw new Error(`dataType tidak dikenal: ${dataType}`);
  }
}

/** Normalisasi body ingest / hasil tarikan Dapodik menjadi payload sync. */
export function normalizeDapodikPayload(raw: unknown): DapodikPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Payload Dapodik tidak valid.");
  }
  const o = raw as Record<string, unknown>;

  // Format per-modul: { dataType, payload } — dari script Python modular.
  if (typeof o.dataType === "string" && "payload" in o) {
    return normalizeDataTypePayload(o.dataType, o.payload);
  }

  // Format penuh: { sekolah, siswa?, gtk?, rombel?, archiveUnlisted? }
  const sekolahRaw = o.sekolah;
  if (!sekolahRaw || typeof sekolahRaw !== "object" || Array.isArray(sekolahRaw)) {
    throw new Error("Field sekolah wajib berupa objek.");
  }
  const sekolah = sekolahRaw as DapodikSekolah;
  if (!normalize(sekolah.nama) || !normalize(sekolah.npsn)) {
    throw new Error("Field sekolah.nama dan sekolah.npsn wajib diisi.");
  }
  const siswa = asList<DapodikSiswa>(o.siswa ?? o.peserta_didik);
  const gtk = asList<DapodikGTK>(o.gtk);
  const rombel = asList<DapodikRombel>(o.rombel);
  const archiveUnlisted =
    typeof o.archiveUnlisted === "boolean" ? o.archiveUnlisted : undefined;
  ensureMaxRows(siswa, gtk, rombel);
  return { sekolah, siswa, gtk, rombel, archiveUnlisted };
}
