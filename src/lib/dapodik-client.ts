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
  alamat: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
}

// Field disesuaikan dengan response asli Dapodik Web Service
// (dikonfirmasi dari struktur yang dipakai di dapodik-sync.ts)
export interface PesertaDidik {
  peserta_didik_id: string;
  nipd?: string; // NIS lokal sekolah
  nisn?: string; // NIS Nasional
  nama: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  alamat_jalan?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  nama_rombel?: string;
  rombongan_belajar_id?: string; // kunci matching ke Class.dapodikId
}

export interface GTK {
  nama: string;
  nuptk?: string;
  nip?: string;
  jabatan?: string;
}

export interface RombonganBelajar {
  rombongan_belajar_id: string;
  nama: string;
  tingkat_pendidikan_id_str?: string;
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

  async getPesertaDidik(): Promise<PesertaDidik[]> {
    return this.requestAllPages<PesertaDidik>("getPesertaDidik");
  }

  async getGTK(): Promise<GTK[]> {
    return this.requestAllPages<GTK>("getGtk");
  }

  async getRombonganBelajar(): Promise<RombonganBelajar[]> {
    return this.requestAllPages<RombonganBelajar>("getRombonganBelajar");
  }

  async getAllData(): Promise<{
    sekolah: Sekolah;
    peserta_didik: PesertaDidik[];
    gtk: GTK[];
    rombel: RombonganBelajar[];
  }> {
    // Dipanggil sequential, bukan Promise.all — Dapodik lokal sering gagal
    // ("Tidak terhubung dengan database") kalau menerima beberapa request
    // paralel sekaligus ke database-nya.
    const sekolah = await this.getSekolah();
    const peserta_didik = await this.getPesertaDidik();
    const gtk = await this.getGTK();
    const rombel = await this.getRombonganBelajar();
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
      return Array.isArray(rows) ? rows[0] : (rows as T);
    }
    return json as T;
  }

  // Untuk endpoint yang hasilnya array & bisa terpaginasi (getPesertaDidik, getGtk, dll).
  // Dapodik Web Service umumnya membatasi jumlah baris per request lewat
  // parameter start/limit — kita loop sampai halaman terakhir supaya data
  // sekolah dengan siswa/guru banyak tidak terpotong.
  private async requestAllPages<T>(endpoint: string, pageSize = 100): Promise<T[]> {
    const allRows: T[] = [];
    let start = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const json = await this.requestRaw(endpoint, { start, limit: pageSize });

      if (!json || typeof json !== "object" || !("rows" in (json as Record<string, unknown>))) {
        // Response tanpa wrapper "rows" — anggap ini hasil lengkap, tidak dipaginasi
        return Array.isArray(json) ? (json as T[]) : [json as T];
      }

      const page = json as DapodikListResponse<T>;
      const rows = Array.isArray(page.rows) ? page.rows : [page.rows];
      allRows.push(...rows);

      if (rows.length < pageSize) break; // sudah sampai halaman terakhir
      start += pageSize;
    }

    return allRows;
  }
}

export default DapodikClient;