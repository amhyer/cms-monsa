export type DapodikData = {
  sekolah?: {
    nama: string;
    npsn: string;
    alamat?: string;
    alamat_jalan?: string;
    provinsi?: string;
    kabupaten?: string;
    kabupaten_kota?: string;
    kecamatan?: string;
    kelurahan?: string;
    desa_kelurahan?: string;
  };
  peserta_didik?: Array<{
    nama: string;
    nipd: string;
    nisn: string;
    nik: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    alamat_jalan: string;
    nomor_telepon_seluler: string;
    nomor_telepon_rumah: string;
    email: string;
    nama_ayah: string;
    pekerjaan_ayah_id_str: string;
    nama_ibu: string;
    pekerjaan_ibu_id_str: string;
    nama_wali: string;
    pekerjaan_wali_id_str: string;
    nama_rombel: string;
    sekolah_asal: string;
    anak_keberapa: string;
    berat_badan: string;
    tinggi_badan: string;
    kebutuhan_khusus: string;
  }>;
  gtk?: Array<{
    nama: string;
    nuptk: string;
    nik: string;
    nip: string;
    jenis_kelamin: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    status_kepegawaian_id_str: string;
    jenis_ptk_id_str: string;
    agama_id_str: string;
    jabatan_ptk_id_str: string;
    pangkat_golongan_terakhir: string;
    pendidikan_terakhir: string;
    bidang_studi_terakhir: string;
  }>;
  rombel?: Array<{ nama: string; tingkat_pendidikan_id_str: string; ptk_id_str: string }>;
};

export type DapodikConfig = {
  npsn: string;
  token: string;
  host: string;
  port: string;
  protocol: string;
  archiveUnlisted: boolean;
  allowInsecureInProduction: boolean;
  cfAccessClientId: string;
  cfAccessClientSecret: string;
};

export type SyncPreview = {
  mode: "dry-run";
  sekolah: { updated: number };
  siswa: { created: number; updated: number; archived: number; errors: number };
  gtk: { created: number; updated: number; archived: number; errors: number };
  rombel: { created: number; updated: number; errors: number };
};

export type StepStatus = "pending" | "loading" | "done" | "error";

// key di sini HARUS sama dengan nilai "endpoint" yang dikirim ke /api/dapodik
// (sekolah, siswa, guru, rombel) — bukan peserta_didik/gtk, biar sinkron
// dengan tombol-tombol lain (SummaryCard, tab Refresh) yang sudah ada.
export const STEPS: { key: "sekolah" | "siswa" | "guru" | "rombel"; label: string }[] = [
  { key: "sekolah", label: "Data Sekolah" },
  { key: "siswa", label: "Peserta Didik" },
  { key: "guru", label: "GTK (Guru & Tendik)" },
  { key: "rombel", label: "Rombongan Belajar" },
];

/** Parse JSON respons dengan aman — jangan pecah pada 500 body kosong. */
export async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
