# 📋 Panduan Sync Dapodik — CMS MONSA

## Ringkasan

Website CMS MONSA bisa menarik data langsung dari Aplikasi Dapodik di PC sekolah melalui Cloudflare Tunnel. Ini berarti admin bisa melakukan sync dari mana saja (bahkan dari HP), selama PC sekolah menyala dan terhubung internet.

---

## ⚠️ Hal Penting yang Perlu Dipahami

1. **Sync hanya berhasil kalau PC sekolah menyala** — Cloudflare Tunnel adalah jembatan dari PC sekolah ke internet. Kalau PC mati, tunnel putus, sync gagal.

2. **Aplikasi Dapodik + Web Service harus aktif** — Bukan cuma PC menyala, tapi Aplikasi Dapodik-nya juga harus dibuka dan fitur Web Service-nya diaktifkan.

3. **Service `cloudflared` harus berjanan** — Ini service yang menjaga tunnel tetap hidup. Kalau service ini berhenti, sync dari Vercel akan gagal.

---

## 🖥️ Setup di PC Sekolah (dikerjakan sekali saja)

### Langkah 1: Install cloudflared

Buka PowerShell sebagai Administrator, jalankan:

```
winget install --id Cloudflare.cloudflared
```

Kalau `winget` tidak ada, download manual dari:
https://github.com/cloudflare/cloudflared/releases (pilih file `.msi` untuk Windows)

### Langkah 2: Login ke akun Cloudflare

```
cloudflared tunnel login
```

Ini akan buka browser. Pilih domain yang sudah terdaftar di akun Cloudflare kamu.

### Langkah 3: Buat tunnel

```
cloudflared tunnel create dapodik-monsa
```

**Catat Tunnel ID** yang muncul (contoh: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Langkah 4: Buat file konfigurasi

Buka Notepad, buat file baru dengan path:
```
C:\Users\<nama-user>\.cloudflared\config.yml
```

Isinya:
```yaml
tunnel: dapodik-monsa
credentials-file: C:\Users\<nama-user>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: dapodik.<namadomainmu>.com
    service: http://localhost:5774
  - service: http_status:404
```

Ganti `<TUNNEL_ID>` dan `<namadomainmu>` sesuai data kamu.

### Langkah 5: Arahkan DNS

```
cloudflared tunnel route dns dapodik-monsa dapodik.<namadomainmu>.com
```

### Langkah 6: Jalankan sebagai Windows Service

```
cloudflared service install
```

Setelah ini, buka `services.msc` → cari "Cloudflared" → pastikan statusnya **Running** dan startup type **Automatic**.

### Langkah 7: Tes dari perangkat lain

Buka browser di HP/laptop lain (bukan dari PC sekolah), akses:
```
https://dapodik.<namadomainmu>.com/getSekolah?npsn=40313912
```

Kalau muncul respons (meski "Access denied"), artinya tunnel sudah tersambung.

---

## 🔐 Keamanan Tambahan (Sangat Disarankan)

Karena Web Service Dapodik sekarang bisa diakses dari internet, tambahkan Cloudflare Access:

1. Buka dashboard Cloudflare → **Zero Trust** → **Access** → **Service Auth** → **Service Tokens** → buat token baru
2. Catat `Client ID` dan `Client Secret`
3. Buat Access Policy untuk hostname `dapodik.<namadomainmu>.com` dengan Service Token

Setelah aktif, setiap request harus menyertakan header:
```
CF-Access-Client-Id: <client id>
CF-Access-Client-Secret: <client secret>
```

---

## ⚙️ Konfigurasi di Dashboard CMS MONSA

1. Login ke dashboard CMS MONSA
2. Buka menu **Dapodik** → **Konfigurasi**
3. Isi field berikut:
   - **NPSN**: `40313912`
   - **Token**: token Dapodik kamu (dari Aplikasi Dapodik → Web Service)
   - **Host**: `dapodik.<namadomainmu>.com` (bukan localhost lagi!)
   - **Protocol**: `https`
   - **Port**: `443` (default HTTPS, bisa dikosongkan)
   - **Cloudflare Access Client ID** (opsional): isi jika pakai Cloudflare Access
   - **Cloudflare Access Client Secret** (opsional): isi jika pakai Cloudflare Access
4. Klik **Simpan Konfigurasi**
5. Klik **Cek Koneksi** — harus muncul nama sekolah yang benar

---

## 🔄 Cara Sync Data

### Sync Manual
1. Buka menu **Dapodik** di dashboard
2. Klik **Tarik Data** (dry-run dulu untuk melihat perubahan)
3. Kalau data sudah benar, klik **Sync & Simpan**

### Sync Otomatis
1. Aktifkan **Auto Sync** di pengaturan Dapodik
2. Atur interval (misal: setiap 24 jam)
3. Sync akan berjalan otomatis sesuai jadwal

---

## 🚨 Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---------|---------------------|--------|
| "Cek Koneksi" gagal | PC sekolah mati | Nyalakan PC sekolah |
| "Cek Koneksi" gagal | Aplikasi Dapodik tidak aktif | Buka Aplikasi Dapodik, aktifkan Web Service |
| "Cek Koneksi" gagal | Service cloudflared berhenti | Buka `services.msc`, start "Cloudflared" |
| "Cek Koneksi" gagal | Token salah | Cek token di Aplikasi Dapodik → Web Service |
| "Cek Koneksi" gagal | IP belum di-whitelist | Pastikan Dapodik sudah mengizinkan akses dari Cloudflare |
| Sync gagal di tengah jalan | PC sekolah mati saat sync | Nyalakan PC, ulang sync |
| "Access denied" dari Cloudflare | Cloudflare Access belum dikonfigurasi | Ikuti Langkah Keamanan Tambahan di atas |

---

## 📞 Kontak

Untuk bantuan teknis, hubungi:
- **Admin CMS**: [isi kontak admin]
- **Cloudflare Support**: https://support.cloudflare.com
