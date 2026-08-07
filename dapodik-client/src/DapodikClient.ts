export interface DapodikConfig {
  npsn: string;
  token: string;
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
  /** Allow HTTP in production (e.g., internal VPN with encryption at network layer).
   *  Default: false. HARUS di-set eksplisit jika memang sengaja. */
  allowInsecureInProduction?: boolean;
}

export interface Sekolah {
  nama: string;
  npsn: string;
  alamat: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  kelurahan: string;
}

export interface PesertaDidik {
  nama_siswa: string;
  nisn: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  alamat: string;
  nama_ortu: string;
}

export interface GTK {
  nama: string;
  nuptk: string;
  nip: string;
  jabatan: string;
}

export interface RombonganBelajar {
  nama_rombel: string;
  tingkat: string;
  wali_kelas: string;
}

export class DapodikClient {
  private npsn: string;
  private token: string;
  private baseUrl: string;

  constructor(config: DapodikConfig) {
    this.npsn = config.npsn;
    this.token = config.token;
    const host = config.host ?? 'localhost';
    const port = config.port ?? 5774;
    const protocol = config.protocol ?? 'http';
    this.baseUrl = `${protocol}://${host}:${port}/WebService`;

    // Guard: HTTP di production tidak diizinkan kecuali allowInsecureInProduction=true
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && protocol === 'http' && !config.allowInsecureInProduction) {
      throw new Error(
        'DapodikClient: Protocol HTTP tidak diizinkan di production. ' +
        'Gunakan HTTPS atau set allowInsecureInProduction=true (hanya untuk internal VPN terenkripsi).'
      );
    }
  }

  async getSekolah(): Promise<Sekolah> {
    return this.request<Sekolah>('DataSekolah');
  }

  async getPesertaDidik(): Promise<PesertaDidik> {
    return this.request<PesertaDidik>('getPesertaDidik');
  }

  async getGTK(): Promise<GTK> {
    return this.request<GTK>('DataGTK');
  }

  async getRombonganBelajar(): Promise<RombonganBelajar> {
    return this.request<RombonganBelajar>('DataRombonganBelajar');
  }

  async getAllData(): Promise<{
    sekolah: Sekolah;
    peserta_didik: PesertaDidik;
    gtk: GTK;
    rombel: RombonganBelajar;
  }> {
    return {
      sekolah: await this.getSekolah(),
      peserta_didik: await this.getPesertaDidik(),
      gtk: await this.getGTK(),
      rombel: await this.getRombonganBelajar(),
    };
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}
