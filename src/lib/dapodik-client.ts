export interface DapodikConfig {
  npsn: string;
  token: string;
  host?: string;
  port?: number;
  protocol?: "http" | "https";
  allowInsecureInProduction?: boolean;
}

export interface Sekolah {
  nama: string;
  npsn: string;
  alamat?: string;
  alamat_jalan?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
}

// Field disesuaikan dengan response asli Dapodik Web Service
export interface PesertaDidik {
  peserta_didik_id: string;
  nipd?: string; // NIS lokal sekolah
  nisn?: string; // NIS Nasional
  nama: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string; // "L" | "P"
  alamat_jalan?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  nama_rombel?: string;
  rombongan_belajar_id?: string; // kunci matching ke Class
  semester_id?: string; // contoh: "20241" — ada di tiap baris response asli
  tahun_ajaran_id?: string;
}

export interface GTK {
  nama: string;
  nuptk?: string;
  nip?: string;
  jabatan?: string;
  jenis_ptk_id_str?: string; // contoh: "Guru Kelas", "Kepala Sekolah"
  semester_id?: string;
}

export interface RombonganBelajar {
  rombongan_belajar_id: string;
  nama: string;
  tingkat_pendidikan_id?: string; // contoh: "1".."6" (SD), "10".."12" (SMA)
  tingkat_pendidikan_id_str?: string;
  semester_id?: string;
}

// "20241" → "2024/2025"; "20242" → "2024/2025" (ganjil & genap dalam satu TA).
function deriveTahunAjaran(semesterId: string): string {
  const year = Number(semesterId.slice(0, 4));
  return `${year}/${year + 1}`;
}

interface DapodikListResponse<T> {
  results?: number;
  id?: string;
  start?: number;
  limit?: number;
  rows: T[] | T;
}

export class DapodikClient {
  private npsn: string;
  private token: string;
  private baseUrl: string;

  constructor(config: DapodikConfig) {
    this.npsn = config.npsn;
    this.token = config.token;

    const host = config.host ?? "localhost";
    const port = config.port ?? 5774;
    const protocol = config.protocol ?? "http";
    this.baseUrl = `${protocol}://${host}:${port}/WebService`;

    // Dapodik Web Service lokal hampir selalu HTTP (jalan di localhost/jaringan
    // sekolah), jadi proteksi ini mencegah salah konfigurasi kalau tidak sengaja
    // di-deploy dengan protocol http di production tanpa disadari.
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && protocol === "http" && !config.allowInsecureInProduction) {
      throw new Error(
        "DapodikClient: HTTP tidak diizinkan di production. Gunakan HTTPS, atau set allowInsecureInProduction=true jika memang Dapodik hanya bisa diakses lewat jaringan lokal/VPN yang sudah aman."
      );
    }
  }

  async getSekolah(): Promise<Sekolah> {
    return this.requestSingle<Sekolah>("getSekolah");
  }

  async getPesertaDidik(semesterId?: string): Promise<PesertaDidik[]> {
    return this.requestAllPages<PesertaDidik>("getPesertaDidik", 100, semesterId);
  }

  async getGTK(semesterId?: string): Promise<GTK[]> {
    return this.requestAllPages<GTK>("getGtk", 100, semesterId);
  }

  async getRombonganBelajar(semesterId?: string): Promise<RombonganBelajar[]> {
    return this.requestAllPages<RombonganBelajar>("getRombonganBelajar", 100, semesterId);
  }

  // Dapodik tidak punya endpoint daftar semester — kumpulkan nilai semester_id
  // unik dari data yang benar-benar tersedia (peserta didik + rombel), tanpa
  // filter semester. Dipanggil sequential (Dapodik tidak suka request paralel).
  async getSemesters(): Promise<string[]> {
    return (await this.getSemestersWithCounts()).semesters;
  }

  // Sama dengan getSemesters, tapi sekalian menghitung jumlah data per
  // semester (siswa & rombel) dari response yang sama — tanpa fetch tambahan.
  // Dipakai dropdown periode untuk badge jumlah data (mis. "20261 · 352 siswa").
  async getSemestersWithCounts(): Promise<{
    semesters: string[];
    counts: Record<string, { siswa: number; rombel: number }>;
  }> {
    const set = new Set<string>();
    const counts: Record<string, { siswa: number; rombel: number }> = {};
    const bump = (sid: string, key: "siswa" | "rombel") => {
      set.add(sid);
      counts[sid] = counts[sid] ?? { siswa: 0, rombel: 0 };
      counts[sid][key] += 1;
    };
    const pd = await this.requestAllPages<PesertaDidik>("getPesertaDidik");
    for (const r of pd) if (r.semester_id) bump(String(r.semester_id), "siswa");
    try {
      const rb = await this.requestAllPages<RombonganBelajar>("getRombonganBelajar");
      for (const r of rb) if (r.semester_id) bump(String(r.semester_id), "rombel");
    } catch {
      // Rombel gagal dimuat — daftar dari peserta didik tetap dipakai.
    }
    // Urut menurun: semester terbaru (paling besar) di posisi teratas.
    return { semesters: [...set].sort().reverse(), counts };
  }

  async getAllData(semesterId?: string): Promise<{
    sekolah: Sekolah;
    peserta_didik: PesertaDidik[];
    gtk: GTK[];
    rombel: RombonganBelajar[];
  }> {
    // Dipanggil sequential, bukan Promise.all — Dapodik lokal sering gagal
    // ("Tidak terhubung dengan database") kalau menerima beberapa request
    // paralel sekaligus ke database-nya.
    const sekolah = await this.getSekolah();
    const peserta_didik = await this.getPesertaDidik(semesterId);
    const gtk = await this.getGTK(semesterId);
    const rombel = await this.getRombonganBelajar(semesterId);
    return { sekolah, peserta_didik, gtk, rombel };
  }

  // ---- Internal helpers ----

  private async requestRaw(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<unknown> {
    const query = new URLSearchParams({
      npsn: this.npsn,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    const url = `${this.baseUrl}/${endpoint}?${query.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      // Dapodik biasanya balas halaman HTML "Access denied" kalau token/npsn
      // salah, atau IP belum di-whitelist di sisi Dapodik.
      throw new Error(
        `Respons dari Dapodik bukan JSON valid (kemungkinan token salah, npsn salah, atau IP belum di-whitelist). Cuplikan: ${text.slice(0, 150)}`
      );
    }
  }

  // Untuk endpoint yang hasilnya satu objek (getSekolah)
  private async requestSingle<T>(endpoint: string): Promise<T> {
    const json = await this.requestRaw(endpoint);
    if (json && typeof json === "object" && "rows" in (json as Record<string, unknown>)) {
      const rows = (json as DapodikListResponse<T>).rows;
      const first = Array.isArray(rows) ? rows[0] : rows;
      if (first) return first;
    }
    return json as T;
  }

  // Untuk endpoint yang hasilnya array & bisa terpaginasi (getPesertaDidik, getGtk, dll).
  // Dapodik Web Service umumnya membatasi jumlah baris per request lewat
  // parameter start/limit — kita loop sampai halaman terakhir supaya data
  // sekolah dengan siswa/guru banyak tidak terpotong.
  //
  // Catatan: beberapa versi Dapodik MENGABAIKAN start/limit dan selalu
  // mengembalikan seluruh baris. Guard di bawah mencegah infinite loop &
  // duplikasi pada kasus itu.
  private async requestAllPages<T>(endpoint: string, pageSize = 100, semesterId?: string): Promise<T[]> {
    const allRows: T[] = [];
    const seenIds = new Set<string>();
    let start = 0;
    let guard = 0;

    while (guard++ < 50) {
      const json = await this.requestRaw(endpoint, {
        start,
        limit: pageSize,
        ...(semesterId
          ? {
              semester_id: semesterId,
              // Beberapa versi Dapodik memfilter lewat tahun_ajaran_id — kirim
              // juga, tidak berbahaya kalau parameter tidak didukung.
              tahun_ajaran_id: deriveTahunAjaran(semesterId),
            }
          : {}),
      });

      if (!json || typeof json !== "object" || !("rows" in (json as Record<string, unknown>))) {
        // Response tanpa wrapper "rows" — anggap ini hasil lengkap, tidak dipaginasi
        return Array.isArray(json) ? (json as T[]) : [json as T];
      }

      const page = json as DapodikListResponse<T>;
      const rows = Array.isArray(page.rows) ? page.rows : [page.rows];

      const before = allRows.length;
      for (const row of rows) {
        const id = (row as { id?: string } | null)?.id ?? JSON.stringify(row);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allRows.push(row);
        }
      }
      // Kondisi berhenti: halaman kosong, ATAU tidak ada baris baru sama sekali
      // (versi Dapodik yang mengabaikan start/limit akan mengulang data yang
      // sama terus — guard ini mencegah infinite loop & duplikasi).
      if (rows.length === 0 || allRows.length === before) break;

      start += rows.length;
    }

    return allRows;
  }
}
