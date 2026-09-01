# Dapodik → CMS MONSA Field Mapping

Field mengikuti response asli Dapodik Web Service (`getSekolah`, `getPesertaDidik`, `getGtk`, `getRombonganBelajar`).

## Siswa (Student)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `peserta_didik_id` | `Student.dapodikId` | **Identifier utama** (unique, untuk matching) |
| `nipd` | `Student.nis` | NIS lokal. Fallback numerik deterministik jika kosong |
| `nisn` | `Student.nisn` | NIS Nasional |
| `nama` | `Student.name` | |
| `tanggal_lahir` | `Student.dateOfBirth` | Parse ISO date |
| `jenis_kelamin` | `Student.gender` | `"L"` / `"Laki-laki"` → `"LAKI_LAKI"`, `"P"` / `"Perempuan"` → `"PEREMPUAN"` |
| `alamat_jalan` | `Student.address` | |
| `nama_ayah` + `nama_ibu` | `Student.parentName` | Digabung `"Ayah / Ibu"` |
| `rombongan_belajar_id` | `Student.classId` | Match `Class.dapodikId`. Fallback: `nama_rombel` → `Class.name` |
| — | `Student.archivedAt` | null = aktif, DateTime = diarsipkan |

## GTK (Teacher)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `nuptk` | `Teacher.nuptk` | **Identifier utama** (unique untuk matching) |
| `nip` | `Teacher.nip` | Fallback identifier jika NUPTK kosong |
| `nama` | `Teacher.name` | |
| `jabatan_ptk_id_str` / `jenis_ptk_id_str` | `Teacher.position` | Fallback `"Guru"` |
| `pendidikan_terakhir` | `Teacher.education` | |
| `nik`, `jenis_kelamin`, `tempat_lahir`, `tanggal_lahir`, `agama_id_str`, `status_kepegawaian_id_str`, `pangkat_golongan_terakhir`, `bidang_studi_terakhir` | kolom Teacher setara | |
| — | `Teacher.archivedAt` | null = aktif, DateTime = diarsipkan |

GTK tanpa NUPTK **dan** NIP dilewati (dihitung `errors`).

## Rombel (Class)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `rombongan_belajar_id` | `Class.dapodikId` | **Identifier utama** (stabil) |
| `nama` | `Class.name` | Fallback matching jika `dapodikId` belum ada |
| `tingkat_pendidikan_id_str` | `Class.grade` | |
| `ptk_id_str` | `Class.homeroomTeacherId` | Resolve: match nama (lowercase) → Teacher.id |
| — | `Class.academicYear` | Tahun ajaran berjalan (Juli–Juni) |

## Sekolah → SiteSetting
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `npsn` | `SiteSetting.npsn` | |
| `nama` | `SiteSetting.schoolName` | |
| `alamat_jalan` (fallback `alamat`) | `SiteSetting.address` | Jangan ditimpa jika keduanya kosong |
| — | **Jangan update** | vision, mission, history, sosmed, stats, dll |

## Jalur ingest (jembatan PC sekolah)

Aplikasi jembatan di PC sekolah menarik endpoint Dapodik yang sama lalu
`POST /api/dapodik/ingest` (header `Authorization: Bearer <kunci pairing>`).
Body JSON:

```json
{
  "sekolah": { "nama": "…", "npsn": "…", "alamat_jalan": "…" },
  "peserta_didik": [ /* getPesertaDidik */ ],
  "gtk": [ /* getGtk */ ],
  "rombel": [ /* getRombonganBelajar */ ]
}
```

`?mode=dry-run` hanya menghitung; tanpa query (default) = commit. Payload
diproses oleh `applyDapodikPayload` — pemetaan field identik dengan sync
langsung dari dashboard. `ping: true` hanya memverifikasi kunci pairing.

## Rules
- **Match siswa**: `peserta_didik_id` dulu, lalu NIS (data lama)
- **Match guru**: NUPTK, lalu NIP
- **Match kelas**: `rombongan_belajar_id`, lalu nama rombel
- **Upsert**: update field yang dikirim Dapodik saja, jangan null-kan field CMS-only
- **Archive**: siswa/guru yang ada di CMS tapi tidak di Dapodik → set `archivedAt = now()` (bisa dimatikan lewat opsi `archiveUnlisted`)
- **Never delete**: data lama tetap ada, riwayat Attendance aman
