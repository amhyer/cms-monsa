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
2. HANYA itu saja — TIDAK perlu install Node.js (pakai mode exe).

Cara pakai (EXE — disarankan)
----------
1. Double-klik Jembatan-Dapodik.exe.
   - Jika muncul peringatan SmartScreen ("Windows protected your PC"):
     klik "More info" lalu "Run anyway".
   - Jika exe datang dari file ZIP: klik-kanan file ZIP → Properties/
     Properti → centang Unblock/Buka blokir → Apply → ekstrak dulu,
     baru jalankan.
2. Muncul jendela hitam (jendela Jembatan) dan browser membuka
   http://127.0.0.1:3847. JANGAN tutup jendela hitam selama penarikan.
   Jika browser tidak terbuka, buka alamat tersebut secara manual.
3. Isi:
   - URL CMS   (contoh: https://sdn-mongisidi1.sch.id)
   - Kunci pairing dari dashboard
   - NPSN, token Web Service Dapodik, host (localhost), port (5774)
4. Tes Dapodik, Tes CMS, lalu Tarik & Kirim.

Kunci pairing dan token Dapodik disimpan di file jembatan-config.json
yang dibuat OTOMATIS di folder yang sama dengan file exe (hanya di
komputer ini; lokasi persisnya ditampilkan di jendela Jembatan).
Jangan kirim file itu ke siapa pun.

Cara pakai (ALTERNATIF — Node.js)
----------
Jika PC sekolah sudah punya Node.js LTS: double-klik MULAI-JEMBATAN.vbs
(atau jalankan.bat / Jembatan-Dapodik.ps1). Cara isinya sama.

Bantuan
-------
- "HTTP 401" dari CMS: kunci pairing salah atau sudah diganti di dashboard.
- "Access denied" / bukan JSON dari Dapodik: token/NPSN Web Service salah,
  atau IP belum di-whitelist di Dapodik.
- "Tidak terhubung dengan database": buka aplikasi Dapodik dulu, tunggu
  status database hijau, lalu coba lagi.
- Form tidak muncul: pastikan jendela Jembatan masih terbuka dan
  menampilkan "Jembatan Dapodik siap", lalu buka http://127.0.0.1:3847
  secara manual. Jika ada pesan kesalahan, minta paket jembatan terbaru.
- Port 3847 "sedang dipakai": tutup jendela Jembatan yang lama,
  lalu jalankan exe-nya lagi.

Membangun ulang exe (untuk developer)
----------
Butuh Bun (https://bun.sh):  powershell -c "irm bun.sh/install.ps1 | iex"
Lalu dari folder ini:
  .\build-exe.ps1
atau satu perintah:
  bun build --compile --target=bun-windows-x64 --outfile Jembatan-Dapodik.exe .\jembatan.mjs
PENTING: jangan build dengan vercel/pkg — pkg tidak mendukung ES Module
(.mjs) sehingga exe-nya error "Cannot find module C:\snapshot\...".
