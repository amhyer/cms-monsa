# Folder foto demo (opsional)

`prisma/seed.ts` memakai placeholder `picsum.photos` untuk data demo. Bila
website dipakai untuk demo publik/ekspor dan butuh foto asli, letakkan file
JPEG di folder ini dengan nama seed yang sama — seed otomatis memakai
`/demo/<nama>.jpg` alih-alih picsum (lihat `demoPhoto()` di `prisma/seed.ts`):

| Nama file | Dipakai oleh | Ukuran anjuran |
| --- | --- | --- |
| `demo-siswa-1.jpg` … `demo-siswa-18.jpg` | Foto siswa + siswa bulan | 400×400 |
| `demo-berita-1.jpg` … `demo-berita-5.jpg` | Sampul berita | 800×450 |
| `demo-galeri-1.jpg` … `demo-galeri-6.jpg` | Galeri (url + thumbnail) | 800×600 |
| `demo-album-1.jpg`, `demo-album-2.jpg` | Sampul album | 600×400 |
| `demo-album-<a>-foto-<p>.jpg` (a=1–2, p=1–3) | Foto dalam album | 800×600 |

Setelah menaruh file, jalankan ulang `bun run db:seed` — baris demo di-upsert
dengan URL lokal. File yang tidak tersedia tetap fallback ke picsum, jadi
isian boleh bertahap.
