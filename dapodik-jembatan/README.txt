Jembatan Dapodik — CMS MONSA
================================

Aplikasi kecil yang dijalankan di komputer sekolah (satu PC dengan Dapodik).
Jembatan menarik data dari Web Service Dapodik (http://localhost:5774) lalu
mengirimnya ke website CMS yang sudah online (HTTPS).

Port 5774 TIDAK perlu dibuka ke internet. Hanya komputer ini yang berbicara
dengan Dapodik; CMS di cloud tidak pernah menyentuh localhost sekolah.

Prasyarat
---------
1. Aplikasi Dapodik sudah terbuka di komputer ini (ikon "terhubung dengan
   database", bukan "Tidak terhubung dengan database").
2. Node.js LTS (https://nodejs.org) — unduh installer Windows, centang
   "Add to PATH", lalu buka ulang Command Prompt.
3. Kunci pairing dari dashboard CMS: menu Penarikan Dapodik → kartu
   "Jembatan PC Sekolah" → Buat kunci pairing. Salin kunci itu (hanya
   tampil sekali).

Cara pakai
----------
1. Double-klik jalankan.bat (atau klik-kanan Jembatan-Dapodik.ps1 →
   Run with PowerShell).
2. Browser akan membuka http://127.0.0.1:3847. Jika tidak terbuka
   otomatis, jangan tutup jendela Jembatan; buka alamat tersebut secara manual.
3. Isi:
   - URL CMS   (contoh: https://sdn-mongisidi1.sch.id)
   - Kunci pairing dari dashboard
   - NPSN, token Web Service Dapodik, host (localhost), port (5774)
4. Tes Dapodik, Tes CMS, lalu Tarik & Kirim.

Kunci pairing dan token Dapodik disimpan di file jembatan-config.json
di folder yang sama (hanya di komputer ini). Jangan kirim file itu ke
siapa pun.

Bantuan
-------
- "HTTP 401" dari CMS: kunci pairing salah atau sudah diganti di dashboard.
- "Access denied" / bukan JSON dari Dapodik: token/NPSN Web Service salah,
  atau IP belum di-whitelist di Dapodik.
- "Tidak terhubung dengan database": buka aplikasi Dapodik dulu, tunggu
  status database hijau, lalu coba lagi.
- Form tidak muncul: pastikan jendela Jembatan masih terbuka dan menampilkan
  "Jembatan Dapodik siap", lalu buka http://127.0.0.1:3847 secara manual.
  Jika ada pesan kesalahan, unduh ulang paket jembatan terbaru dari CMS.
