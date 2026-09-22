// Barrel `@/lib/dapodik-sync` — hasil pemisahan modul (P2-2).
// Lapisan: types (kontrak data), normalize (validasi payload),
// plan (orkestrasi dry-run/commit), commit (transaksi DB + arsip).
//
// Re-export helper & config dipertahankan agar 18 import lama
// `@/lib/dapodik-sync` (mis. import { normalize } dari route sync)
// tetap bekerja tanpa perubahan.
export * from "./types";
export * from "./normalize";
export * from "./plan";
export * from "./commit";

export {
  mapGender,
  parseDate,
  currentAcademicYear,
  normalize,
  resolveSchoolAddress,
  combineParentName,
  parseGradeFromRombel,
  resolveNis,
} from "@/lib/dapodik-sync-helpers";
export {
  getDapodikClient,
  saveDapodikConfig,
  getDapodikConfig,
  testConnection,
} from "@/lib/dapodik-config";
