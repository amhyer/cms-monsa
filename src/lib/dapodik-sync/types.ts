// Tipe-tipe payload & hasil sync Dapodik — diekstrak dari dapodik-sync.ts
// (P2-2) tanpa perubahan bentuk.

export type DapodikSiswa = {
  peserta_didik_id: string;
  nipd?: string; // NIS lokal sekolah — dipakai untuk Student.nis
  nisn?: string; // NIS Nasional — dipakai untuk Student.nisn
  nama: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  alamat_jalan?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  nama_rombel?: string;
  rombongan_belajar_id?: string; // kunci matching ke Class.dapodikId
};

export type DapodikGTK = {
  nama: string;
  nuptk?: string;
  nip?: string;
  nik?: string;
  jenis_kelamin?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  agama_id_str?: string;
  status_kepegawaian_id_str?: string;
  jenis_ptk_id_str?: string;
  pangkat_golongan_terakhir?: string;
  pendidikan_terakhir?: string;
  bidang_studi_terakhir?: string;
  jabatan_ptk_id_str?: string; // "Kepala Sekolah" | "Guru Kelas" | "Guru Mapel" | "TAS" ...
};

export type DapodikRombel = {
  rombongan_belajar_id: string; // disimpan sebagai Class.dapodikId
  nama: string;
  tingkat_pendidikan_id_str?: string;
  ptk_id_str?: string; // nama wali kelas
};

export type DapodikSekolah = {
  nama: string;
  npsn: string;
  alamat?: string;
  alamat_jalan?: string;
};

export type SyncResult = {
  sekolah: { updated: number };
  siswa: { created: number; updated: number; archived: number; errors: number };
  gtk: { created: number; updated: number; archived: number; errors: number };
  rombel: { created: number; updated: number; errors: number };
};

export type DryRunResult = SyncResult & { mode: "dry-run" };
export type CommitResult = SyncResult & { mode: "commit"; logId: string };

export type DapodikPayload = {
  sekolah: DapodikSekolah;
  siswa: DapodikSiswa[];
  gtk: DapodikGTK[];
  rombel: DapodikRombel[];
  /**
   * Override config archiveUnlisted untuk request ini. Dipakai oleh script
   * Python saat mengirim data dalam beberapa chunk: tiap chunk harus kirim
   * `archiveUnlisted: false` agar siswa/guru di chunk lain tidak ikut
   * terarsip sebelum semua chunk terkirim. Arsip dilakukan terpisah via
   * POST /api/dapodik/archive setelah semua chunk berhasil.
   */
  archiveUnlisted?: boolean;
};

export type ArchiveResult = {
  siswaArchived: number;
  gtkArchived: number;
};
