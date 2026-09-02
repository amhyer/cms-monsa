# Strategi Transaksi Sinkronisasi Dapodik

Dokumen ini menjelaskan bagaimana `applyDapodikPayload()` di
`src/lib/dapodik-sync.ts` menyimpan data ke database, dan mengapa strateginya
dipilih seperti itu.

## Masalah yang diperbaiki

Sebelumnya seluruh proses commit dibungkus dalam **satu** interactive
transaction Prisma tanpa opsi timeout:

```ts
await db.$transaction(async (tx) => { /* ratusan query */ });
```

Interactive transaction Prisma memakai timeout bawaan **5 detik**. Payload
nyata dari sekolah (1 sekolah, 12 rombel, ±30 GTK, ±450 siswa) membutuhkan
ratusan query berurutan, jadi transaksi sudah ditutup server sebelum proses
selesai. Akibatnya muncul error produksi:

```text
Invalid `prisma.teacher.create()` invocation:
Transaction API error: Transaction not found. Transaction ID is invalid,
refers to an old closed transaction Prisma doesn't have information about
anymore, or was obtained before disconnecting.
```

Ini adalah Prisma error **P2028**. Errornya muncul di `teacher.create()` hanya
karena kebetulan di situlah batas 5 detik terlampaui — penyebab sebenarnya
adalah durasi transaksi, bukan data GTK.

## Perbaikan

### 1. Timeout transaksi eksplisit

```ts
export const DAPODIK_TX_OPTIONS = {
  maxWait: 10_000,  // maksimum menunggu koneksi dari pool
  timeout: 25_000,  // batas hidup satu interactive transaction
} as const;
```

`maxWait + timeout = 35 detik`, aman di bawah batas request Vercel
(`maxDuration = 60` pada `src/app/api/dapodik/ingest/route.ts`). Semua
`$transaction` pada jalur commit memakai opsi ini.

### 2. Menghilangkan N+1 (tidak hanya bergantung pada timeout)

Timeout yang lebih besar saja tidak cukup — jumlah query juga dikurangi:

| Sebelum | Sesudah |
| --- | --- |
| `teacher.findFirst()` per GTK (±30 query) | map `teacherByNuptk` / `teacherByNip` yang sudah dimuat di awal |
| `teacher.findMany()` + `class.findUnique()` per rombel untuk wali kelas | map nama guru hasil sync, langsung `class.updateMany` |
| `student.update()` / `teacher.update()` satu per ID saat mengarsip | `updateMany({ where: { id: { in: [...] } } })` per potongan 500 ID |

### 3. Batch transaksi untuk siswa

Siswa diproses per batch `DAPODIK_STUDENT_BATCH_SIZE = 100`, masing-masing
dalam transaksi tersendiri. Dengan begitu satu transaksi hanya berisi ±100
query dan tidak pernah mendekati batas 25 detik, berapa pun jumlah siswanya.

Urutan commit:

1. **Transaksi 1** — upsert sekolah, create/update rombel, create/update GTK,
   pemasangan wali kelas.
2. **Transaksi 2..n** — siswa, 100 per transaksi.
3. **Transaksi terakhir** — pengarsipan (`updateMany`), **hanya** dijalankan
   setelah seluruh batch utama berhasil.

## Konsistensi data bila terjadi kegagalan

Karena commit dipecah menjadi beberapa transaksi, prosesnya **tidak lagi
atomik secara global**. Ini trade-off yang disengaja: satu transaksi global
mustahil diselesaikan dalam batas waktu serverless. Jaminannya sekarang:

- **Setiap batch atomik.** Batch yang gagal di-rollback penuh; tidak ada
  siswa yang setengah tersimpan di dalam satu batch.
- **Pengarsipan selalu terakhir.** Bila ada batch yang gagal, error langsung
  dilempar dan pengarsipan **tidak pernah** berjalan. Jadi kegagalan tidak
  pernah menonaktifkan siswa/guru yang sebenarnya masih aktif.
- **Data baru tidak ikut terarsip.** Kandidat arsip hanya diambil dari ID yang
  sudah ada di database **sebelum** sync (`allExistingIds`, `existingTeacherIds`)
  dikurangi ID yang tersinkron pada run ini.
- **Sync bersifat idempoten.** Menjalankan ulang "Tarik & Kirim" setelah
  kegagalan aman: data yang sudah masuk akan di-*update* (bukan diduplikasi)
  karena matching memakai identitas stabil.
- **Tidak ada penghapusan data.** Hanya `archivedAt` + `isActive: false`, dan
  hanya bila `archiveUnlisted` bernilai true.

Karena itu, kegagalan di tengah proses meninggalkan database dalam keadaan
"sebagian tersinkron tetapi konsisten", dan pengguna diberi tahu lewat pesan
API agar mengulang sinkronisasi.

## Aturan matching (tidak berubah)

- **Siswa**: `peserta_didik_id` → fallback `nis`.
- **GTK**: `nuptk` → fallback `nip`.
- **Kelas**: `rombongan_belajar_id` → fallback `nama`.

Guru/siswa yang baru dibuat langsung dimasukkan ke map in-memory sehingga
payload yang memuat entri duplikat tidak membuat baris ganda.

## Respons API

`/api/dapodik/ingest` **selalu** membalas JSON. Penerjemahan error ada di
`src/lib/dapodik-ingest-error.ts`:

| Kondisi | Status | Body |
| --- | --- | --- |
| Sukses | 200 | `{ ok: true, mode, sekolah, siswa, gtk, rombel, ... }` |
| Validasi payload | 400 | `{ error: "<pesan operator>" }` |
| P2028 / P2024 | 503 | `{ error: "<penjelasan + saran ulangi>", code }` |
| Error Prisma lain | 502 | `{ error: "Gagal menyimpan data Dapodik ke database.", code }` |
| Lainnya | 502 | `{ error: "Gagal memproses data Dapodik." }` |

Stack trace, connection string, token Dapodik, dan kunci pairing tidak pernah
dikirim ke klien.

## Dry-run

Perilaku `dry-run` tidak berubah: tidak ada `$transaction` yang dijalankan dan
tidak ada penulisan ke database. Hitungan dry-run dan commit konsisten (diuji
di `src/lib/__tests__/dapodik-sync-transaction.test.ts`).

## Jembatan

Perubahan ini murni di backend CMS. Aplikasi jembatan di PC sekolah **tidak
perlu diunduh ulang**.
