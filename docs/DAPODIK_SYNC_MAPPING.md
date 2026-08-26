# Dapodik → CMS MONSA Field Mapping

## Siswa (Student)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `nisn` | `Student.nisn` | **Identifier utama** (unique, untuk matching) |
| `nama_siswa` | `Student.name` | |
| `tanggal_lahir` | `Student.dateOfBirth` | Parse ISO date |
| `jenis_kelamin` | `Student.gender` | "Laki-laki" → "LAKI_LAKI", "Perempuan" → "PEREMPUAN" |
| `alamat` | `Student.address` | |
| `nama_ortu` | `Student.parentName` | |
| (class resolved) | `Student.classId` | Match `nama_rombel` → Class.id |
| — | `Student.nis` | Copy dari `nisn` jika kosong |
| — | `Student.archivedAt` | null = aktif, DateTime = diarsipkan |

## GTK (Teacher)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `nuptk` | `Teacher.nuptk` | **Identifier utama** (unique untuk matching) |
| `nip` | `Teacher.nip` | Fallback identifier jika NUPTK kosong |
| `nama` | `Teacher.name` | |
| `jabatan` | `Teacher.position` | |
| — | `Teacher.archivedAt` | null = aktif, DateTime = diarsipkan |

## Rombel (Class)
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `nama_rombel` | `Class.name` | **Identifier utama** (unique, untuk matching) |
| `tingkat` | `Class.grade` | |
| `wali_kelas` | `Class.homeroomTeacherId` | Resolve: match nama → Teacher.id |
| — | `Class.academicYear` | Dari config atau current year |
| — | `Class.dapodikId` | ID rombel dari Dapodik (stabil) |

## Sekolah → SiteSetting
| Dapodik Field | CMS Field | Notes |
|---------------|-----------|-------|
| `npsn` | `SiteSetting.npsn` | |
| `nama` | `SiteSetting.schoolName` | |
| `alamat` | `SiteSetting.address` | |
| — | **Jangan update** | vision, mission, history, sosmed, stats, dll |

## Rules
- **Match**: by identifier stabil (NISN, NUPTK, nama_rombel)
- **Upsert**: update field yang dikirim Dapodik saja, jangan null-kan field CMS-only
- **Archive**: student/teacher yang ada di CMS tapi tidak di Dapodik → set `archivedAt = now()`
- **Never delete**: data lama tetap ada, riwayat Attendance/Payment aman
