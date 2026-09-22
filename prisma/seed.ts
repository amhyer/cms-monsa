/**
 * Seed data DEMO untuk pengembangan lokal — BUKAN seed produksi, BUKAN seed E2E.
 *
 * Isi data sekolah SD Indonesia yang realistis (pengguna, guru, siswa, berita,
 * pengumuman, BOS, dll) supaya `npm run dev` langsung menampilkan situs yang
 * hidup — bukan halaman kosong maupun fixture E2E (judul "Berita E2E 1").
 *
 * Kontrak:
 *  - Idempoten: semua baris memakai ID tetap berawalan `demo-` / email
 *    `@sekolahdemo.id`, upsert by unique key — aman dijalankan ulang.
 *  - Tidak menyentuh data E2E (ID `e2e-*`, email `@mongisidi1.sch.id`); bila
 *    terdeteksi, seed tetap jalan tapi memberi peringatan.
 *
 * Pengaman:
 *  - Menolak DATABASE_URL yang menunjuk Neon (host *.neon.tech) agar demo data
 *    tidak pernah bisa masuk database produksi.
 *  - Menolak DATABASE_URL kosong/tidak valid (mis. `.env` belum diisi).
 *
 * Pemakaian: bun run db:seed   (= bunx tsx prisma/seed.ts)
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/**
 * Foto placeholder untuk data demo. Default: picsum.photos — disengaja untuk
 * seed dev (kontrak di header: seed ini sudah menolak DB produksi). Untuk
 * demo publik/ekspor, letakkan foto asli di `public/demo/<seed>.jpg` (lihat
 * public/demo/README.md) — seed otomatis memakai jalur lokal itu.
 */
function demoPhoto(seed: string, width: number, height: number): string {
  if (existsSync(join("public", "demo", `${seed}.jpg`))) {
    return `/demo/${seed}.jpg`;
  }
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// ---- Muat .env / .env.local sendiri (tsx tidak memuat otomatis) ----
// Precedensi mengikuti Next.js: .env.local menang atas .env; env shell
// (di-set eksplisit dari luar) menang atas keduanya. Catatan: `bun run`
// meng-inject isi .env ke process.env sebelum script jalan — nilai yang
// identik dengan .env di-upgrade ke nilai .env.local, sedangkan nilai dari
// shell yang benar-benar eksternal dibiarkan menang.
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readEnvFileRaw(path)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
function readEnvFileRaw(path: string): string[] {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
}
const dotEnv = readEnvFile(".env");
const merged = { ...dotEnv, ...readEnvFile(".env.local") };
for (const [k, v] of Object.entries(merged)) {
  const cur = process.env[k];
  if (cur === undefined || cur === dotEnv[k]) process.env[k] = v;
}

// ---- Pengaman ----
const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl) fail("DATABASE_URL belum di-set — salin .env.example ke .env lalu isi.");
let host = "";
try {
  host = new URL(dbUrl).hostname;
} catch {
  fail(`DATABASE_URL tidak valid ("${dbUrl.slice(0, 24)}…") — periksa .env / .env.local.`);
}
if (host.endsWith(".neon.tech") || host.includes("neon")) {
  fail(
    `DATABASE_URL menunjuk ke Neon (${host}) — seed demo dilarang menyentuh database produksi. Arahkan .env ke PostgreSQL lokal (docker compose -f docker-compose.dev.yml up -d).`
  );
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const today = new Date();
const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const pdfEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** PDF minimal 1 halaman (Helvetica) — cukup untuk demo unduh dokumen BOS. */
function makePdf(title: string, lines: string[]): Buffer {
  const content = [
    `BT /F1 14 Tf 56 780 Td (${pdfEscape(title)}) Tj ET`,
    ...lines.map((l, i) => `BT /F1 11 Tf 56 ${748 - i * 18} Td (${pdfEscape(l)}) Tj ET`),
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

/** Tulis PDF demo ke public/uploads (backend disk) sekali saja. */
function ensurePdf(filename: string, title: string, lines: string[]): { fileUrl: string; fileSize: number } {
  const dir = join(process.cwd(), "public", "uploads");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  if (!existsSync(path)) writeFileSync(path, makePdf(title, lines));
  return { fileUrl: `/uploads/${filename}`, fileSize: statSync(path).size };
}

async function main() {
  console.log("🌱 Seed demo (dev) — data sekolah contoh, ID berawalan demo-");

  // ---- Opsional: --purge-e2e menghapus sisa data seed E2E (ID berawalan e2e-)
  // sebelum men-seed, supaya dev murni tidak menampilkan fixture uji. Hanya
  // baris ber-ID/nis pola E2E yang disentuh — akun asli tidak mungkin kena
  // (cuid, bukan prefiks e2e-). Urutan mengikuti FK (anak dulu, User terakhir);
  // kelas ditangani khusus: hapus bila kosong, jika masih dirujuk siswa lama
  // cukup diganti nama agar nama "Kelas XA" bebas untuk kelas demo (fase 2
  // di bawah menghapusnya setelah siswa demo berpindah).
  if (process.argv.includes("--purge-e2e")) {
    const e2eUserIds = (await db.user.findMany({ where: { id: { startsWith: "e2e-user-" } }, select: { id: true } })).map((u) => u.id);
    const res = {
      attendance: await db.attendance.deleteMany({ where: { OR: [{ student: { nis: { startsWith: "E2E" } } }, { classId: { startsWith: "e2e-" } }] } }),
      student: await db.student.deleteMany({ where: { nis: { startsWith: "E2E" } } }),
      teacher: await db.teacher.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      news: await db.news.deleteMany({ where: { slug: { startsWith: "e2e-" } } }),
      schoolAnnouncement: await db.schoolAnnouncement.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      announcement: await db.announcement.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      announcementRead: await db.announcementRead.deleteMany({ where: { OR: [{ announcementId: { startsWith: "e2e-" } }, { userId: { in: e2eUserIds } }] } }),
      agenda: await db.agenda.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      galleryItem: await db.galleryItem.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      achievement: await db.achievement.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      orgStructure: await db.orgStructure.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      newsTicker: await db.newsTicker.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      bosExpenditure: await db.bosExpenditure.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      bosDocument: await db.bosDocument.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      document: await db.document.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      photo: await db.photo.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      album: await db.album.deleteMany({ where: { id: { startsWith: "e2e-" } } }),
      user: e2eUserIds.length ? await db.user.deleteMany({ where: { id: { in: e2eUserIds } } }) : { count: 0 },
    };
    let classDeleted = 0;
    let classRenamed = 0;
    for (const c of await db.class.findMany({ where: { id: { startsWith: "e2e-" } } })) {
      try {
        await db.class.delete({ where: { id: c.id } });
        classDeleted++;
      } catch {
        await db.class.update({ where: { id: c.id }, data: { name: `${c.name} (arsip e2e)` } });
        classRenamed++;
      }
    }
    const total = Object.values(res).reduce((s, r) => s + r.count, 0) + classDeleted + classRenamed;
    console.log(`🧹 Purge E2E (fase 1) — ${total} baris dihapus (${Object.entries(res).filter(([, r]) => r.count).map(([k, r]) => `${k}:${r.count}`).join(", ") || "kosong"}${classRenamed ? `, class diganti nama:${classRenamed}` : ""}).`);
  }

  // Peringatan bila database juga berisi data E2E (dua seed bisa hidup berdampingan)
  const [e2eNews, e2eUsers] = await Promise.all([
    db.news.count({ where: { slug: { startsWith: "e2e-" } } }),
    db.user.count({ where: { id: { startsWith: "e2e-user-" } } }),
  ]);
  if (e2eNews + e2eUsers > 0) {
    console.log(
      `⚠  Database ini juga berisi data E2E (${e2eUsers} akun, ${e2eNews} berita e2e-*) — ` +
        "seed demo tidak menghapusnya. Jalankan `bunx tsx prisma/seed.ts --purge-e2e` untuk dev murni."
    );
  }

  const password = hashPassword("demo123");

  // ============ 1. PENGGUNA (5 role) ============
  // Guru & siswa ditautkan setelah Teacher/Student dibuat (id deterministik).
  const users = [
    { id: "demo-user-admin", name: "Administrator Sekolah", email: "admin@sekolahdemo.id", role: "SUPER_ADMIN" },
    { id: "demo-user-operator", name: "Operator Sekolah", email: "operator@sekolahdemo.id", role: "OPERATOR" },
    { id: "demo-user-guru", name: "Andi Saputra, S.Pd.", email: "guru@sekolahdemo.id", role: "GURU" },
    { id: "demo-user-ortu", name: "Bapak Hasan Basri", email: "ortu@sekolahdemo.id", role: "ORANG_TUA" },
    { id: "demo-user-siswa", name: "Nabila Putri Azizah", email: "siswa@sekolahdemo.id", role: "SISWA" },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: { password, role: u.role, isActive: true, mustChangePassword: false },
      create: { ...u, password },
    });
  }

  // ============ 2. GURU (1 kepala sekolah + 6 wali kelas) ============
  const teacherDefs = [
    { name: "Drs. H. Muhammad Rivai, M.Pd.", position: "Kepala Sekolah", subject: null, gender: "LAKI_LAKI" },
    { name: "Andi Saputra, S.Pd.", position: "Guru Kelas", subject: "Kelas 1A", gender: "LAKI_LAKI" },
    { name: "Siti Aminah Hakim, S.Pd.", position: "Guru Kelas", subject: "Kelas 2A", gender: "PEREMPUAN" },
    { name: "Rahmawati Yusuf, S.Pd.", position: "Guru Kelas", subject: "Kelas 3A", gender: "PEREMPUAN" },
    { name: "Abdul Rahman Tahir, S.Pd.", position: "Guru Kelas", subject: "Kelas 4A", gender: "LAKI_LAKI" },
    { name: "Nur Fadillah Ambo, S.Pd.", position: "Guru Kelas", subject: "Kelas 5A", gender: "PEREMPUAN" },
    { name: "Iwan Darmawan, S.Pd.", position: "Guru Kelas", subject: "Kelas 6A", gender: "LAKI_LAKI" },
  ];
  for (let i = 0; i < teacherDefs.length; i++) {
    const t = teacherDefs[i];
    await db.teacher.upsert({
      where: { id: `demo-teacher-${i + 1}` },
      update: {},
      create: {
        id: `demo-teacher-${i + 1}`,
        name: t.name,
        position: t.position,
        subject: t.subject,
        education: "S1 PGSD",
        gender: t.gender,
        tempatLahir: "Makassar",
        tanggalLahir: new Date(1985 + i, (i * 3) % 12, 10 + i),
        agama: "ISLAM",
        statusKepegawaian: "PNS",
        jenisPtk: "Guru Kelas",
        nuptk: `2${String(1975010100000000 + i * 1234567).slice(0, 15)}`,
        nip: `19800${(i % 9) + 1}15200${String(9 + i).padStart(2, "0")}12200${i}1`,
        nik: `737101${String(1505850000000 + i * 77777).slice(0, 10)}`,
        email: `guru${i + 1}@sekolahdemo.id`,
        motto: "Guru berkarya, murid berprestasi.",
        riwayat: `Menjadi pendidik di SD Negeri sejak ${2008 + i}, fokus pada pembelajaran aktif dan penguatan karakter.`,
        order: i + 1,
        isActive: true,
      },
    });
  }
  // Akun GURU memegang kelas 1A (wali kelas) — demo absensi wali kelas.
  await db.user.update({ where: { email: "guru@sekolahdemo.id" }, data: { teacherId: "demo-teacher-2" } });

  // ============ 3. KELAS (1A–6A, tahun ajaran berjalan) ============
  // Nama kelas adalah unique key — bila seed E2E sudah membuat "Kelas 1A",
  // baris itu diadopsi (id aslinya dipakai) alih-alih membuat duplikat.
  const classIds: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const cls = await db.class.upsert({
      where: { name: `Kelas ${i}A` },
      // update mengisi wali kelas juga saat baris diadopsi (mis. dibuat seed
      // E2E tanpa homeroom) — idempoten karena nilainya tetap sama.
      update: { homeroomTeacherId: `demo-teacher-${i + 1}`, isActive: true },
      create: {
        id: `demo-class-${i}`,
        name: `Kelas ${i}A`,
        grade: String(i),
        academicYear: "2025/2026",
        homeroomTeacherId: `demo-teacher-${i + 1}`,
        isActive: true,
      },
    });
    classIds.push(cls.id);
  }

  // ============ 4. SISWA (2–3 per kelas, NIS/NISN realistis) ============
  const studentDefs = [
    "Nabila Putri Azizah", "Ahmad Fauzan Ridwan", "Alya Nur Rahmadani",
    "Bagas Prakoso Wibowo", "Cindy Amelia Sari", "Dani Mulianto",
    "Elsa Wulandari Putri", "Farhan Abimanyu", "Gita Cahaya Kartika",
    "Hendra Gunawan Sahabuddin", "Indah Permata Cahyani", "Joko Purnomo Aji",
    "Kirana Maharani Sultan", "Luthfi Ramadhan Ilahi", "Mutiara Salsabila Daeng",
    "Naufal Hidayatullah", "Olivia Zahra Mulya", "Putra Wahyu Setiawan",
  ];
  for (let i = 0; i < studentDefs.length; i++) {
    const grade = (i % 6) + 1;
    await db.student.upsert({
      where: { nis: `2025${String(i + 1).padStart(3, "0")}` },
      // update classId juga: bila run sebelumnya mengadopsi kelas e2e (nama
      // sama), siswa dipindah ke kelas demo — syarat purge bisa hapus kelas e2e.
      update: { classId: classIds[grade - 1], isActive: true },
      create: {
        id: `demo-student-${i + 1}`,
        nis: `2025${String(i + 1).padStart(3, "0")}`,
        nisn: `00${String(5100000000 + i * 137).slice(0, 8)}`,
        name: studentDefs[i],
        dateOfBirth: new Date(2014 + (grade - 1), (i * 5) % 12, ((i * 7) % 27) + 1),
        gender: i % 2 === 0 ? "PEREMPUAN" : "LAKI_LAKI",
        address: `Jl. Monginsidi KM-${(i % 9) + 1}, Maricaya Baru, Makassar`,
        parentName: ["Hasan Basri", "Rusnawati", "Syamsuddin", "Halimah", "Bakri", "Nurhayati"][i % 6],
        parentPhone: `0852${String(41000000 + i * 91337).slice(0, 8)}`,
        photoUrl: demoPhoto(`demo-siswa-${i + 1}`, 400, 400),
        classId: classIds[grade - 1],
        isActive: true,
      },
    });
  }
  // Akun portal: ORANG_TUA memantau siswa pertama, SISWA masuk sebagai siswa pertama.
  await db.user.update({ where: { email: "ortu@sekolahdemo.id" }, data: { guardianStudentId: "demo-student-1" } });
  await db.user.update({ where: { email: "siswa@sekolahdemo.id" }, data: { studentId: "demo-student-1" } });

  // ============ 5. PURGE FASE 2 — kelas e2e (aman: tidak ada lagi siswa/absensi yang merujuk) ============
  if (process.argv.includes("--purge-e2e")) {
    const cls = await db.class.deleteMany({ where: { id: { startsWith: "e2e-" } } });
    console.log(`🧹 Purge E2E (fase 2) — class:${cls.count}.`);
  }

  // ============ 6. KEHADIRAN HARI INI (kelas 1A penuh + sebaran status) ============
  for (let i = 0; i < 3; i++) {
    const statuses = ["HADIR", "HADIR", "IZIN", "HADIR", "SAKIT", "HADIR"] as const;
    await db.attendance.upsert({
      where: { studentId_date: { studentId: `demo-student-${i + 1}`, date: midnight } },
      update: {},
      create: {
        studentId: `demo-student-${i + 1}`,
        classId: classIds[0],
        date: midnight,
        status: statuses[i],
        note: statuses[i] === "IZIN" ? "Acara keluarga" : statuses[i] === "SAKIT" ? "Demam, ada surat dokter" : null,
        createdById: "demo-user-guru",
      },
    });
  }

  // ============ 6. BERITA (5 publik + 1 draft) ============
  const newsDefs = [
    { t: "Upacara Peringatan HUT ke-80 Kemerdekaan RI", c: "Kegiatan", d: -3,
      x: "Seluruh peserta didik mengikuti upacara bendera dengan pawai kirungan dan lomba kebersihan kelas." },
    { t: "Peserta P5 Tema Kewirausahaan Pasarkan Hasil Projek", c: "Akademik", d: -8,
      x: "Murid kelas 5A dan 6A menjual kerajinan daur ulang hasil projek penguatan profil pelajar Pancasila." },
    { t: "Juara 1 Lomba Cerdas Cermat Tingkat Kecamatan", c: "Prestasi", d: -15,
      x: "Tim cerdas cermat SD Negeri Unggulan Mongisidi 1 membawa piala juara 1 pada lomba antar-SD kecamatan." },
    { t: "Pemeriksaan Kesehatan Berkala Bersama Puskesmas", c: "Kegiatan", d: -22,
      x: "Puskesmas Maricaya melakukan pemeriksaan tinggi badan, berat badan, dan kesehatan gigi seluruh murid." },
    { t: "Rapat Komite Sekolah Semester Ganjil", c: "Kegiatan", d: -30,
      x: "Perwakilan orang tua membahas program kerja semester ganjil dan rencana study tour kelas 6." },
  ];
  for (let i = 0; i < newsDefs.length; i++) {
    const n = newsDefs[i];
    await db.news.upsert({
      where: { slug: `demo-berita-${i + 1}` },
      update: {},
      create: {
        slug: `demo-berita-${i + 1}`,
        title: n.t,
        excerpt: n.x,
        content: `${n.x}\n\nKegiatan ini merupakan bagian dari program rutin sekolah untuk menumbuhkan semangat belajar, kemandirian, dan kepedulian sosial peserta didik. Sekolah menyampaikan terima kasih kepada seluruh guru, komite, dan orang tua atas dukungannya.\n\nDokumentasi kegiatan dapat dilihat pada galeri foto di laman galeri sekolah.`,
        coverImage: demoPhoto(`demo-berita-${i + 1}`, 800, 450),
        category: n.c,
        status: "PUBLISHED",
        authorId: "demo-user-admin",
        publishedAt: day(n.d),
      },
    });
  }
  await db.news.upsert({
    where: { slug: "demo-berita-draft" },
    update: {},
    create: {
      slug: "demo-berita-draft",
      title: "Persiapan Pentas Seni Akhir Tahun Ajaran",
      excerpt: "Draf berita pentas seni — belum dipublikasikan, contoh alur kerja DRAFT.",
      content: "Naskah lengkap pentas seni akhir tahun ajaran sedang disusun bersama komite seni.",
      category: "Kegiatan",
      status: "DRAFT",
      authorId: "demo-user-operator",
    },
  });

  // ============ 7. PENGUMUMAN SEKOLAH (SchoolAnnouncement — ticker + panel) ============
  const annDefs = [
    { t: "Libur Semester Ganjil Tahun Ajaran 2025/2026", c: "Jadwal", p: "HIGH", pin: true,
      x: "Kegiatan belajar mengajar libur mulai 22 Desember; pembagian rapor dilaksanakan 20 Desember." },
    { t: "Pendaftaran SPMB/PPDB Tahun Ajaran 2026/2027 Dibuka", c: "Penting", p: "URGENT", pin: false,
      x: "Pendaftaran murid baru dibuka online melalui laman SPMB sekolah mulai awal semester genap." },
    { t: "Jadwal Ujian Sekolah Kelas 6", c: "Akademik", p: "NORMAL", pin: false,
      x: "Ujian sekolah kelas 6 dilaksanakan serentak minggu kedua bulan Mei; kartu peserta dibagikan lewat wali kelas." },
  ];
  for (let i = 0; i < annDefs.length; i++) {
    const a = annDefs[i];
    await db.schoolAnnouncement.upsert({
      where: { id: `demo-schoolann-${i + 1}` },
      update: {},
      create: {
        id: `demo-schoolann-${i + 1}`,
        title: a.t,
        content: a.x,
        summary: a.x,
        category: a.c,
        priority: a.p,
        isPinned: a.pin,
        isPublished: true,
        publishedAt: day(-(i + 1)),
        createdById: "demo-user-admin",
      },
    });
  }

  // ============ 8. AGENDA (4 ke depan) ============
  const agendaDefs = [
    { t: "Upacara Bendera Senin", cat: "Umum", off: 3, loc: "Lapangan Sekolah" },
    { t: "Jumat Bersih & Senam Sehat", cat: "Kegiatan", off: 5, loc: "Lingkungan Sekolah" },
    { t: "Rapat Dinas Guru", cat: "Umum", off: 7, loc: "Ruang Guru" },
    { t: "Peringatan Hari Guru Nasional", cat: "Kegiatan", off: 14, loc: "Aula Sekolah" },
  ];
  for (let i = 0; i < agendaDefs.length; i++) {
    const g = agendaDefs[i];
    await db.agenda.upsert({
      where: { id: `demo-agenda-${i + 1}` },
      update: {},
      create: {
        id: `demo-agenda-${i + 1}`,
        title: g.t,
        description: `${g.t} — seluruh peserta didik dan pendidik diharapkan hadir tepat waktu.`,
        date: day(g.off),
        time: "07.30",
        location: g.loc,
        category: g.cat,
      },
    });
  }

  // ============ 9. GALERI (6 foto, kategori beragam) ============
  for (let i = 1; i <= 6; i++) {
    await db.galleryItem.upsert({
      where: { id: `demo-gallery-${i}` },
      update: {},
      create: {
        id: `demo-gallery-${i}`,
        title: ["Upacara HUT RI", "Pasarkan Projek P5", "Juara Cerdas Cermat", "Perpustakaan Mini", "Ruang Kelas Baru", "Taman Baca"][i - 1],
        description: "Dokumentasi kegiatan sekolah.",
        type: "PHOTO",
        url: demoPhoto(`demo-galeri-${i}`, 800, 600),
        thumbnail: demoPhoto(`demo-galeri-${i}`, 400, 300),
        category: (["Kegiatan", "Kegiatan", "Prestasi", "Fasilitas", "Fasilitas", "Kegiatan"] as const)[i - 1],
      },
    });
  }

  // ============ 10. ALBUM + FOTO (2 album) ============
  for (let a = 1; a <= 2; a++) {
    await db.album.upsert({
      where: { id: `demo-album-${a}` },
      update: {},
      create: {
        id: `demo-album-${a}`,
        name: a === 1 ? "Kegiatan Upacara & Peringatan" : "Ekstrakurikuler & Projek P5",
        description: "Kumpulan foto kegiatan sekolah.",
        coverUrl: demoPhoto(`demo-album-${a}`, 600, 400),
        category: a === 1 ? "Upacara" : "Kegiatan",
        isPublished: true,
        sortOrder: a,
        createdById: "demo-user-admin",
      },
    });
    for (let p = 1; p <= 3; p++) {
      await db.photo.upsert({
        where: { id: `demo-photo-${a}-${p}` },
        update: {},
        create: {
          id: `demo-photo-${a}-${p}`,
          albumId: `demo-album-${a}`,
          title: `Foto Kegiatan ${a}-${p}`,
          url: demoPhoto(`demo-album-${a}-foto-${p}`, 800, 600),
          thumbnailUrl: demoPhoto(`demo-album-${a}-foto-${p}`, 400, 300),
          mimeType: "image/jpeg",
          isFeatured: a === 1 && p === 1,
          sortOrder: p,
          uploadedById: "demo-user-admin",
        },
      });
    }
  }

  // ============ 11. PRESTASI (3, tertaut ke siswa) ============
  const achDefs = [
    { t: "Juara 1 Cerdas Cermat Kecamatan", lv: "Kecamatan", cat: "Akademik", s: 3 },
    { t: "Juara 2 Lomba Lari 100m O2SN", lv: "Kabupaten", cat: "Non-Akademik", s: 7 },
    { t: "Harapan 1 Lomba Menggambar Tingkat Kota", lv: "Kabupaten", cat: "Non-Akademik", s: 11 },
  ];
  for (let i = 0; i < achDefs.length; i++) {
    const a = achDefs[i];
    await db.achievement.upsert({
      where: { id: `demo-achievement-${i + 1}` },
      update: {},
      create: {
        id: `demo-achievement-${i + 1}`,
        title: a.t,
        description: `${a.t} — diraih pada lomba yang diselenggarakan dinas pendidikan setempat.`,
        studentId: `demo-student-${a.s}`,
        studentName: studentDefs[a.s - 1],
        level: a.lv,
        category: a.cat,
        date: day(-(i + 2) * 10),
      },
    });
  }

  // ============ 12. STRUKTUR ORGANISASI (4) ============
  const orgDefs = [
    { n: "Drs. H. Muhammad Rivai, M.Pd.", p: "Kepala Sekolah" },
    { n: "Hasnawatti Latif, S.Pd.", p: "Wakil Kepala Bidang Kurikulum" },
    { n: "Operator Sekolah", p: "Operator Dapodik" },
    { n: "Sutarno", p: "Bendahara BOS" },
  ];
  for (let i = 0; i < orgDefs.length; i++) {
    const o = orgDefs[i];
    await db.orgStructure.upsert({
      where: { id: `demo-org-${i + 1}` },
      update: {},
      create: {
        id: `demo-org-${i + 1}`,
        name: o.n,
        position: o.p,
        bio: `${o.n} menjabat sebagai ${o.p} pada UPT SPF SD Negeri Unggulan Mongisidi 1.`,
        contact: `humas${i + 1}@sekolahdemo.id`,
        nuptk: `2${String(1976010100000000 + i * 7654321).slice(0, 15)}`,
        nip: `19810${(i % 9) + 1}10201${String(0 + i)}12300${i}`,
        nik: `737102${String(1206880000000 + i * 55555).slice(0, 10)}`,
        order: i + 1,
        isActive: true,
      },
    });
  }

  // ============ 13. TICKER BERITA (3) ============
  for (let i = 1; i <= 3; i++) {
    await db.newsTicker.upsert({
      where: { id: `demo-ticker-${i}` },
      update: {},
      create: {
        id: `demo-ticker-${i}`,
        content: [
          "Selamat kepada tim cerdas cermat — juara 1 tingkat kecamatan!",
          "Pembagian rapor semester ganjil: 20 Desember 2025.",
          "Pendaftaran murid baru SPMB 2026/2027 dibuka awal semester genap.",
        ][i - 1],
        category: (["Prestasi", "Jadwal", "Info"] as const)[i - 1],
        isActive: true,
        priority: i,
      },
    });
  }

  // ============ 14. LINIMASA SEJARAH SEKOLAH (4) ============
  const timelineDefs = [
    { y: 1982, t: "Sekolah Berdiri", d: "UPT SPF SD Negeri Unggulan Mongisidi 1 mulai beroperasi dengan empat ruang kelas." },
    { y: 2009, t: "Akreditasi A", d: "Menerima peringkat akreditasi A dari BAN S/M Sulawesi Selatan." },
    { y: 2018, t: "Pembangunan Ruang Kelas Baru", d: "Dua ruang kelas baru dan taman baca dibangun melalui dana BOS dan bantuan pemda." },
    { y: 2024, t: "Sekolah Penggerak", d: "Resmi ditetapkan sebagai Sekolah Penggerak angkatan terbaru." },
  ];
  for (let i = 0; i < timelineDefs.length; i++) {
    const e = timelineDefs[i];
    await db.schoolTimeline.upsert({
      where: { id: `demo-timeline-${i + 1}` },
      update: {},
      create: {
        id: `demo-timeline-${i + 1}`,
        year: e.y,
        title: e.t,
        description: e.d,
        category: i === 2 ? "Pembangunan" : "Pencapaian",
        sortOrder: i + 1,
        isPublished: true,
      },
    });
  }

  // ============ 15. TESTIMONI ORANG TUA (2, tampil publik) ============
  for (let i = 1; i <= 2; i++) {
    await db.parentTestimonial.upsert({
      where: { id: `demo-testimoni-${i}` },
      update: {},
      create: {
        id: `demo-testimoni-${i}`,
        parentName: i === 1 ? "Hasan Basri" : "Rusnawati",
        studentName: i === 1 ? "Nabila Putri Azizah" : "Cindy Amelia Sari",
        className: i === 1 ? "Kelas 1A" : "Kelas 2A",
        relation: i === 1 ? "Ayah" : "Ibu",
        content:
          i === 1
            ? "Anak kami jadi semangat berangkat sekolah. Gurunya sabar dan komunikasi dengan wali kelas sangat lancar lewat portal orang tua."
            : "Program P5 dan ekstrakurikulernya beragam. Anak jadi berani tampil dan lebih mandiri.",
        rating: i === 1 ? 5 : 4,
        isApproved: true,
        isPublished: true,
      },
    });
  }

  // ============ 16. BINTANG BULAN INI (siswa + guru) ============
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  await db.starOfMonth.upsert({
    where: { type_month_year: { type: "STUDENT", month, year } },
    update: {},
    create: {
      type: "STUDENT",
      month,
      year,
      studentId: "demo-student-1",
      reason: "Paling rajin dan tekun mengumpulkan tugas selama bulan ini.",
      photoUrl: demoPhoto("demo-siswa-1", 400, 400),
      isActive: true,
    },
  });
  await db.starOfMonth.upsert({
    where: { type_month_year: { type: "TEACHER", month, year } },
    update: {},
    create: {
      type: "TEACHER",
      month,
      year,
      teacherId: "demo-teacher-3",
      reason: "Inovatif mengembangkan media pembelajaran interaktif.",
      isActive: true,
    },
  });

  // ============ 17. TRANSPARANSI BOS (8 belanja ARKAS + 2 dokumen PDF) ============
  const bosDefs = [
    { cat: "Honorarium", item: "Honorarium guru honorer bulan Januari", amt: 12_500_000, q: 1, src: "BOS Reguler" },
    { cat: "Pembelajaran", item: "Pengadaan buku bacaan perpustakaan", amt: 8_200_000, q: 1, src: "BOS Reguler" },
    { cat: "Operasional", item: "Langganan listrik dan air semester 1", amt: 6_400_000, q: 2, src: "BOS Reguler" },
    { cat: "Serana", item: "Pemeliharaan meja kursi ruang kelas", amt: 4_750_000, q: 2, src: "DAK" },
    { cat: "Kegiatan", item: "Pelaksanaan class meeting dan lomba HUT RI", amt: 3_500_000, q: 3, src: "BOS Kinerja" },
    { cat: "Pembelajaran", item: "Pengadaan alat peraga matematika", amt: 5_300_000, q: 3, src: "BOS Reguler" },
    { cat: "Honorarium", item: "Honorarium pengawas ujian sekolah", amt: 2_100_000, q: 3, src: "BOS Kinerja" },
    { cat: "Serana", item: "Perbaikan atap dan plafon ruang guru", amt: 9_800_000, q: 3, src: "BOS Reguler" },
  ];
  for (let i = 0; i < bosDefs.length; i++) {
    const b = bosDefs[i];
    await db.bosExpenditure.upsert({
      where: { id: `demo-bos-${i + 1}` },
      update: {},
      create: {
        id: `demo-bos-${i + 1}`,
        year: 2026,
        source: b.src,
        category: b.cat,
        item: b.item,
        amount: b.amt,
        quarter: b.q,
        note: null,
        recordedById: "demo-user-operator",
      },
    });
  }
  const bosPdfA = ensurePdf("demo-bos-output-2026.pdf", "Output ARKAS Triwulan I 2026", [
    "UPT SPF SD Negeri Unggulan Mongisidi 1 — NPSN 40313912",
    "Rekapitulasi belanja BOS Reguler triwulan I tahun anggaran 2026.",
    "1. Honorarium guru honorer: Rp12.500.000",
    "2. Pengadaan buku bacaan perpustakaan: Rp8.200.000",
    "Dokumen demo untuk pengembangan lokal.",
  ]);
  const bosPdfB = ensurePdf("demo-bos-verifikasi-2026.pdf", "Bukti Verifikasi Belanja Triwulan II 2026", [
    "UPT SPF SD Negeri Unggulan Mongisidi 1 — NPSN 40313912",
    "Lampiran bukti belanja triwulan II tahun anggaran 2026.",
    "1. Langganan listrik dan air: Rp6.400.000",
    "2. Pemeliharaan meja kursi (DAK Serena): Rp4.750.000",
    "Dokumen demo untuk pengembangan lokal.",
  ]);
  await db.bosDocument.upsert({
    where: { id: "demo-bosdoc-1" },
    update: {},
    create: {
      id: "demo-bosdoc-1", year: 2026, title: "Output ARKAS Triwulan I 2026",
      description: "Rekap belanja ARKAS triwulan I (dokumen demo).",
      fileUrl: bosPdfA.fileUrl, fileName: "demo-bos-output-2026.pdf", fileSize: bosPdfA.fileSize,
      uploadedById: "demo-user-operator",
    },
  });
  await db.bosDocument.upsert({
    where: { id: "demo-bosdoc-2" },
    update: {},
    create: {
      id: "demo-bosdoc-2", year: 2026, title: "Bukti Verifikasi Belanja Triwulan II 2026",
      description: "Lampiran bukti belanja triwulan II (dokumen demo).",
      fileUrl: bosPdfB.fileUrl, fileName: "demo-bos-verifikasi-2026.pdf", fileSize: bosPdfB.fileSize,
      uploadedById: "demo-user-operator",
    },
  });

  // ============ 18. DOKUMEN PUBLIK (3) ============
  const pubPdf = ensurePdf("demo-tata-tertib.pdf", "Tata Tertib Peserta Didik", [
    "UPT SPF SD Negeri Unggulan Mongisidi 1",
    "Ringkasan tata tertib peserta didik tahun ajaran 2025/2026.",
    "Dokumen demo untuk pengembangan lokal.",
  ]);
  const docDefs = [
    { t: "Tata Tertib Peserta Didik 2025/2026", c: "Kesiswaan", f: "demo-tata-tertib.pdf", pdf: pubPdf },
    { t: "Output ARKAS Triwulan I 2026", c: "Keuangan", f: "demo-bos-output-2026.pdf", pdf: bosPdfA },
    { t: "Kalender Akademik 2025/2026", c: "Kurikulum", f: "demo-bos-verifikasi-2026.pdf", pdf: bosPdfB },
  ];
  for (let i = 0; i < docDefs.length; i++) {
    const d = docDefs[i];
    await db.schoolDocument.upsert({
      where: { id: `demo-schooldoc-${i + 1}` },
      update: {},
      create: {
        id: `demo-schooldoc-${i + 1}`,
        title: d.t,
        description: "Dokumen demo untuk pengembangan lokal.",
        category: d.c,
        fileUrl: d.pdf.fileUrl,
        fileName: d.f,
        fileSize: d.pdf.fileSize,
        fileType: "pdf",
        accessLevel: "PUBLIC",
        isPublished: true,
        uploadedById: "demo-user-admin",
      },
    });
  }

  // ============ 19. PESAN MASUK & PENGADUAN (2 + 2) ============
  await db.contactMessage.upsert({
    where: { id: "demo-pesan-1" },
    update: {},
    create: {
      id: "demo-pesan-1",
      name: "Hasan Basri",
      email: "hasan.basri@contoh.id",
      phone: "085241111111",
      subject: "Jadwal absensi online",
      message: "Selamat pagi, bagaimana cara melihat kehadiran anak di portal orang tua? Terima kasih.",
      isRead: false,
    },
  });
  await db.contactMessage.upsert({
    where: { id: "demo-pesan-2" },
    update: {},
    create: {
      id: "demo-pesan-2",
      name: "Rina Kartika",
      email: "rina.kartika@contoh.id",
      subject: "Pendaftaran murid baru",
      message: "Saya ingin menanyakan persyaratan SPMB untuk anak usia 6 tahun. Apakah pendaftaran online?",
      isRead: true,
    },
  });
  await db.complaint.upsert({
    where: { id: "demo-pengaduan-1" },
    update: {},
    create: {
      id: "demo-pengaduan-1",
      name: "Bakri Amirullah",
      email: "bakri@contoh.id",
      phone: "085242222222",
      role: "Orang Tua",
      category: "Fasilitas",
      subject: "Keran air wudhu sedang rusak",
      message: "Mohon perbaikan keran air wudhu area depan. Terjadi sejak Senin pagi.",
      status: "DIPROSES",
      priority: "NORMAL",
    },
  });
  await db.complaint.upsert({
    where: { id: "demo-pengaduan-2" },
    update: {},
    create: {
      id: "demo-pengaduan-2",
      name: "Nurhayati",
      email: "nurhayati@contoh.id",
      phone: "085243333333",
      role: "Orang Tua",
      category: "Akademik",
      subject: "Permintaan jadwal ulang les renang",
      message: "Mohon pertimbangan jadwal ekstrakurikuler renang yang bersinggungan dengan les privat.",
      status: "SELESAI",
      priority: "RENDAH",
      response: "Terima kasih masukannya. Jadwal renang digeser ke hari Jumat pekan berikutnya.",
      responseBy: "demo-user-admin",
      respondedAt: day(-2),
    },
  });

  // ============ 20. SPMB/PPDB (2 pendaftar) ============
  await db.enrollment.upsert({
    where: { id: "demo-enrollment-1" },
    update: {},
    create: {
      id: "demo-enrollment-1",
      nisn: "0051240019",
      fullName: "Raisha Aulia Pratiwi",
      gender: "PEREMPUAN",
      dateOfBirth: new Date(2019, 4, 12),
      placeOfBirth: "Makassar",
      address: "Jl. Bau Massepe No. 12, Maricaya Baru",
      parentName: "Muhammad Takdir",
      parentPhone: "085244444444",
      parentEmail: "takdir@contoh.id",
      previousSchool: "TK Kartika XI-1 Makassar",
      programChoice: "Zonasi",
      status: "PENDING",
    },
  });
  await db.enrollment.upsert({
    where: { id: "demo-enrollment-2" },
    update: {},
    create: {
      id: "demo-enrollment-2",
      nisn: "0051120044",
      fullName: "Muhammad Fadhil Rahman",
      gender: "LAKI_LAKI",
      dateOfBirth: new Date(2018, 8, 3),
      placeOfBirth: "Makassar",
      address: "Jl. Andi Pangerang Pettarani No. 8",
      parentName: "Sitti Marwah",
      parentPhone: "085245555555",
      previousSchool: "TK ABA Induk Maricaya",
      programChoice: "Afirmasi",
      status: "ACCEPTED",
      notes: "Lolos verifikasi dokumen; ditetapkan diterima.",
      reviewedById: "demo-user-admin",
      reviewedAt: day(-5),
    },
  });

  // ============ 21. PENGATURAN SITUS (singleton — vision/mission wajib) ============
  await db.siteSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      vision: "Terwujudnya peserta didik yang beriman, bertakwa, berprestasi, dan berbudaya lingkungan.",
      mission: "Menyelenggarakan pembelajaran aktif dan menyenangkan;\nMembiasakan ibadah dan akhlak mulia;\nMengembangkan bakat melalui ekstrakurikuler;\nMenanamkan budaya bersih dan hijau.",
      history: "Berdiri tahun 1982 di kawasan Maricaya Baru, sekolah tumbuh menjadi sekolah unggulan kecamatan dengan akreditasi A.",
      principalWelcome: "Assalamualaikum warahmatullahi wabarakatuh. Selamat datang di laman resmi sekolah kami — jendela informasi kegiatan, prestasi, dan layanan pendidikan.",
      spmbInfo: "Pendaftaran murid baru tahun ajaran 2026/2027 dibuka melalui jalur zonasi, afirmasi, dan perpindahan tugas. Informasi lengkap tersedia di laman SPMB.",
    },
  });

  const counts = {
    users: await db.user.count({ where: { email: { endsWith: "@sekolahdemo.id" } } }),
    guru: await db.teacher.count({ where: { id: { startsWith: "demo-" } } }),
    siswa: await db.student.count({ where: { id: { startsWith: "demo-" } } }),
    berita: await db.news.count({ where: { slug: { startsWith: "demo-" } } }),
    bos: await db.bosExpenditure.count({ where: { id: { startsWith: "demo-" } } }),
  };
  console.log(`✓ Seed demo selesai — ${JSON.stringify(counts)}`);
  console.log("  Login: admin@sekolahdemo.id / demo123 (SUPER_ADMIN), operator@ / guru@ / ortu@ / siswa@sekolahdemo.id — semua demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
