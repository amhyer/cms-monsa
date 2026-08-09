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
  semester_id?: string; // format "YYYYx" mis. 20261 (untuk filter getSemesters)
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
  semester_id?: string; // format "YYYYx" mis. 20261
  ptk_id?: string; // wali kelas dari Dapodik
  ptk_id_str?: string; // nama wali kelas
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
    const extra: Record<string, string> = {};
    if (semesterId) {
      extra.semester_id = semesterId;
      const tahun = semesterToTahunAjaran(semesterId);
      if (tahun) extra.tahun_ajaran_id = tahun;
    }
    return this.requestAllPages<PesertaDidik>("getPesertaDidik", 100, extra);
  }

  async getGTK(semesterId?: string): Promise<GTK[]> {
    const extra: Record<string, string> = {};
    if (semesterId) {
      extra.semester_id = semesterId;
      const tahun = semesterToTahunAjaran(semesterId);
      if (tahun) extra.tahun_ajaran_id = tahun;
    }
    return this.requestAllPages<GTK>("getGtk", 100, extra);
  }

  async getRombonganBelajar(semesterId?: string): Promise<RombonganBelajar[]> {
    const extra: Record<string, string> = {};
    if (semesterId) {
      extra.semester_id = semesterId;
      const tahun = semesterToTahunAjaran(semesterId);
      if (tahun) extra.tahun_ajaran_id = tahun;
    }
    return this.requestAllPages<RombonganBelajar>("getRombonganBelajar", 100, extra);
  }

  /**
   * Kumpulkan semester_id unik dari peserta didik + rombel (terurut menurun).
   * Tahan-banting: kalau salah satu endpoint gagal, tetap balas data dari
   * endpoint yang berhasil.
   */
  async getSemesters(): Promise<string[]> {
    const ids = new Set<string>();
    let primaryFailed = false;
    try {
      const pd = await this.getPesertaDidik();
      for (const p of pd) if (p.semester_id) ids.add(p.semester_id);
    } catch {
      primaryFailed = true;
    }
    if (primaryFailed && ids.size === 0) {
      throw new Error("getSemesters: gagal mengambil semester dari peserta didik dan rombel.");
    }
    try {
      const rb = await this.getRombonganBelajar();
      for (const r of rb) if (r.semester_id) ids.add(r.semester_id);
    } catch {
      // rombel gagal — pakai hasil dari peserta didik saja
    }
    return sortedIdsDesc(ids);
  }

  /** Seperti getSemesters, plus jumlah siswa/rombel per semester (untuk badge UI). */
  async getSemestersWithCounts(): Promise<{
    semesters: string[];
    counts: Record<string, { siswa: number; rombel: number }>;
  }> {
    const counts: Record<string, { siswa: number; rombel: number }> = {};
    const touch = (id: string) => {
      if (!counts[id]) counts[id] = { siswa: 0, rombel: 0 };
    };
    let anySource = false;

    try {
      const pd = await this.getPesertaDidik();
      for (const p of pd) {
        if (p.semester_id) {
          touch(p.semester_id);
          counts[p.semester_id].siswa++;
          anySource = true;
        }
      }
    } catch {
      // tetap lanjut ke rombel
    }

    try {
      const rb = await this.getRombonganBelajar();
      for (const r of rb) {
        if (r.semester_id) {
          touch(r.semester_id);
          counts[r.semester_id].rombel++;
          anySource = true;
        }
      }
    } catch {
      // tetap pakai hasil peserta didik (kalau ada)
    }

    if (!anySource) {
      throw new Error("Mengambil semester gagal: peserta didik dan rombel tidak merespons.");
    }
    return { semesters: sortedIdsDesc(new Set(Object.keys(counts))), counts };
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

    // Server Dapodik lokal sering "belum siap" sesaat (mis. DB loader-nya
    // baru nyambung setelah error "Tidak terhubung dengan database"). Retry
    // singkat dengan backoff dipakai supaya tarikan manual/jadwal tidak gagal
    // hanya karena server sempat menolak. Token salah (401/403) TIDAK di-retry.
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 30_000;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          // 5xx bisa bersifat sementara — retry; selain itu putus (token dll.)
          if (response.status < 500 || attempt === MAX_ATTEMPTS) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          await sleep(backoffMs(attempt));
          continue;
        }

        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch {
          // Dapodik biasanya balas halaman HTML "Access denied" kalau token/
          // npsn salah, atau IP belum di-whitelist — dan halaman "Tidak
          // terhubung dengan database" saat DB server-nya putus sesaat.
          const msg = `Respons dari Dapodik bukan JSON valid (kemungkinan token salah, npsn salah, atau IP belum di-whitelist). Cuplikan: ${text.slice(0, 150)}`;
          if (attempt === MAX_ATTEMPTS) throw new Error(msg);
          lastError = new Error(msg);
          await sleep(backoffMs(attempt));
        }
      } catch (err) {
        // AbortError / TypeError (jaringan) — sementara, layak di-retry.
        lastError = err;
        if (attempt === MAX_ATTEMPTS) throw err;
        await sleep(backoffMs(attempt));
      }
    }

    throw lastError;
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
  private async requestAllPages<T>(
    endpoint: string,
    pageSize = 100,
    extraParams: Record<string, string> = {}
  ): Promise<T[]> {
    const allRows: T[] = [];
    let start = 0;
    let lastPageKeys: string[] | null = null;

    // Dipagari: berhenti saat halaman kosong/duplikat (lihat bawah).
    while (true) {
      const json = await this.requestRaw(endpoint, { start, limit: pageSize, ...extraParams });

      if (!json || typeof json !== "object" || !("rows" in (json as Record<string, unknown>))) {
        // Response tanpa wrapper "rows" — anggap ini hasil lengkap, tidak dipaginasi
        return Array.isArray(json) ? (json as T[]) : [json as T];
      }

      const page = json as DapodikListResponse<T>;
      const rows = Array.isArray(page.rows) ? page.rows : [page.rows];

      if (rows.length === 0) break; // sudah sampai halaman terakhir

      // Guard dedupe: kalau Dapodik mengabaikan start/limit (balas halaman yang
      // sama terus), jangan infinite-loop — berhenti saat halaman identik.
      const pageKeys = rows.map((r) =>
        JSON.stringify(r as unknown as Record<string, unknown>)
      );
      if (lastPageKeys && sameRows(lastPageKeys, pageKeys)) {
        break;
      }
      lastPageKeys = pageKeys;

      allRows.push(...rows);
      start += pageSize;
    }

    return allRows;
  }
}

// "20261" -> "2026/2027"; "20252" -> "2025/2026"; tak dikenal -> null
function semesterToTahunAjaran(semesterId: string): string | null {
  const m = /^(\d{4})([126])$/.exec(semesterId);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  return m[2] === "2" ? `${year - 1}/${year}` : `${year}/${year + 1}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  // 400ms lalu 1200ms
  return attempt === 1 ? 400 : 1200;
}

function sortedIdsDesc(ids: Set<string>): string[] {
  return [...ids].sort().reverse();
}

function sameRows(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default DapodikClient;