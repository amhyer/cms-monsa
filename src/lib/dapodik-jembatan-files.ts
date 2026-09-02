import files from "@/lib/dapodik-jembatan-files.json";

export const JEMBATAN_FILE_NAMES = [
  "README.txt",
  "MULAI-JEMBATAN.vbs",
  "jalankan.bat",
  "Jembatan-Dapodik.ps1",
  "jembatan.mjs",
] as const;

export type JembatanFileName = (typeof JEMBATAN_FILE_NAMES)[number];

const bundled = files as Record<string, string>;

/** Isi paket unduhan jembatan (tersimpan di bundle agar jalan di Vercel). */
export function getJembatanFiles(): { name: string; content: string }[] {
  return JEMBATAN_FILE_NAMES.map((name) => {
    const content = bundled[name];
    if (typeof content !== "string") {
      throw new Error(`Berkas jembatan ${name} tidak ditemukan di bundle.`);
    }
    return { name, content };
  });
}
