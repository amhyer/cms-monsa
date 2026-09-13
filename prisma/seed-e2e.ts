/**
 * Seed khusus E2E (CI / self-host test) — BUKAN seed produksi.
 *
 * Latar belakang: suite Playwright mengasumsikan pengguna & konten dasar
 * ada (lihat e2e/helpers.ts: admin/operator/guru), tetapi `prisma/seed.ts`
 * sengaja no-op dan database CI hanya berisi schema (`db:push`). Akibatnya
 * semua spec yang login gagal massal di CI (83 gagal pada run #93) sementara
 * secara lokal "lulus" karena E2E menembak database produksi Neon.
 *
 * Seed ini idempoten (semua baris memakai ID tetap berawalan `e2e-`,
 * upsert by id) sehingga aman dijalankan ulang per run CI.
 *
 * PENGAMAN (dua lapis, keduanya wajib):
 *  1. Harus dipanggil dengan E2E_SEED=1 secara eksplisit.
 *  2. Menolak DATABASE_URL yang mengarah ke Neon (host *.neon.tech) agar
 *     tidak pernah bisa menyentuh database produksi.
 *
 * Pemakaian: E2E_SEED=1 bunx tsx prisma/seed-e2e.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ---- Pengaman ----
if (process.env.E2E_SEED !== "1") {
  fail(
    "Seed E2E hanya boleh dijalankan dengan E2E_SEED=1 (melindungi database nyata)."
  );
}
const dbUrl = process.env.DATABASE_URL ?? "";
let host = "";
try {
  host = new URL(dbUrl).hostname;
} catch {
  fail("DATABASE_URL tidak valid atau tidak di-set.");
}
if (host.endsWith(".neon.tech") || host.includes("neon")) {
  fail(
    `DATABASE_URL menunjuk ke Neon (${host}) — seed E2E dilarang menyentuh database produksi.`
  );
}

/** scrypt "salt:hash" hex — format sama dengan src/lib/password.ts (OWASP M1). */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  }).toString("hex");
  return `${salt}:${hash}`;
}

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

async function main() {
  console.log("🌱 Seed E2E — pengguna + konten dasar (idempoten, ID tetap e2e-*)");

  // ---- Pengguna (kredensial harus = e2e/helpers.ts) ----
  const users = [
    { id: "e2e-user-admin", name: "Admin E2E", email: "admin@mongisidi1.sch.id", password: "admin123", role: "SUPER_ADMIN" },
    { id: "e2e-user-operator", name: "Operator E2E", email: "operator@mongisidi1.sch.id", password: "operator123", role: "OPERATOR" },
    { id: "e2e-user-guru", name: "Guru E2E", email: "guru@mongisidi1.sch.id", password: "guru123", role: "GURU" },
  ] as const;
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: { password: hashPassword(u.password), role: u.role, isActive: true, mustChangePassword: false },
      create: { ...u, password: hashPassword(u.password) },
    });
  }

  // ---- Kelas & siswa ----
  const classes = [
    { id: "e2e-class-1a", name: "Kelas 1A", grade: "1", academicYear: "2025/2026" },
    { id: "e2e-class-2a", name: "Kelas 2A", grade: "2", academicYear: "2025/2026" },
  ];
  for (const c of classes) {
    await db.class.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  for (let i = 1; i <= 6; i++) {
    await db.student.upsert({
      where: { nis: `E2E${String(i).padStart(3, "0")}` },
      update: {},
      create: {
        nis: `E2E${String(i).padStart(3, "0")}`,
        nisn: `00${String(i).padStart(8, "0")}`,
        name: `Siswa E2E ${i}`,
        gender: i % 2 === 0 ? "PEREMPUAN" : "LAKI_LAKI",
        parentName: `Orang Tua E2E ${i}`,
        classId: i <= 3 ? "e2e-class-1a" : "e2e-class-2a",
      },
    });
  }

  // ---- Guru (direktori /academic + modal profil: bio & kontak) ----
  for (let i = 1; i <= 4; i++) {
    await db.teacher.upsert({
      where: { id: `e2e-teacher-${i}` },
      update: {},
      create: {
        id: `e2e-teacher-${i}`,
        name: `Guru E2E ${i}`,
        position: i === 1 ? "Kepala Sekolah" : "Guru Kelas",
        subject: i === 1 ? null : "Kelas " + i,
        education: "S1 PGSD",
        riwayat: `Bio singkat Guru E2E ${i} untuk modal profil.`,
        email: `guru${i}@mongisidi1.sch.id`,
      },
    });
  }

  // ---- Berita (halaman /news + dashboard) ----
  for (let i = 1; i <= 8; i++) {
    await db.news.upsert({
      where: { slug: `e2e-berita-${i}` },
      update: {},
      create: {
        slug: `e2e-berita-${i}`,
        title: `Berita E2E ${i}`,
        excerpt: `Ringkasan berita E2E ${i}.`,
        content: `Konten lengkap berita E2E ${i}.`,
        category: ["Akademik", "Kegiatan", "Prestasi"][i % 3],
        status: "PUBLISHED",
        authorId: "e2e-user-admin",
        publishedAt: day(-i),
      },
    });
  }

  // ---- Pengumuman, agenda, galeri, prestasi, struktur organisasi ----
  for (let i = 1; i <= 3; i++) {
    await db.announcement.upsert({
      where: { id: `e2e-ann-${i}` },
      update: {},
      create: {
        id: `e2e-ann-${i}`,
        title: `Pengumuman E2E ${i}`,
        content: `Isi pengumuman E2E ${i}.`,
        isPinned: i === 1,
        isActive: true,
      },
    });
  }
  for (let i = 1; i <= 5; i++) {
    await db.agenda.upsert({
      where: { id: `e2e-agenda-${i}` },
      update: {},
      create: {
        id: `e2e-agenda-${i}`,
        title: `Agenda E2E ${i}`,
        description: `Deskripsi agenda E2E ${i}.`,
        date: day(i * 3),
        time: "08:00",
        location: `Tempat E2E ${i}`,
        category: ["Akademik", "Kegiatan", "Libur"][i % 3],
      },
    });
  }
  for (let i = 1; i <= 6; i++) {
    await db.galleryItem.upsert({
      where: { id: `e2e-gallery-${i}` },
      update: {},
      create: {
        id: `e2e-gallery-${i}`,
        title: `Galeri E2E ${i}`,
        type: "PHOTO",
        url: "/img/placeholder.svg",
        thumbnail: "/img/placeholder.svg",
        category: ["Kegiatan", "Prestasi", "Fasilitas"][i % 3],
      },
    });
  }
  for (let i = 1; i <= 3; i++) {
    await db.achievement.upsert({
      where: { id: `e2e-ach-${i}` },
      update: {},
      create: {
        id: `e2e-ach-${i}`,
        title: `Prestasi E2E ${i}`,
        description: `Deskripsi prestasi E2E ${i}.`,
        studentName: `Siswa E2E ${i}`,
        level: ["Sekolah", "Kabupaten", "Provinsi"][i - 1],
        category: i % 2 === 0 ? "Non-Akademik" : "Akademik",
        date: day(-i * 7),
      },
    });
  }
  for (let i = 1; i <= 5; i++) {
    await db.orgStructure.upsert({
      where: { id: `e2e-org-${i}` },
      update: {},
      create: {
        id: `e2e-org-${i}`,
        name: `Pengurus E2E ${i}`,
        position: ["Kepala Sekolah", "Guru Kelas 1A", "Guru Kelas 2A", "Operator", "Bendahara"][i - 1],
        bio: `Bio pengurus E2E ${i}.`,
        contact: `pengurus${i}@mongisidi1.sch.id`,
        order: i,
        isActive: true,
      },
    });
  }

  // ---- Transparansi BOS (spec menghitung halaman secara dinamis) ----
  for (let i = 1; i <= 25; i++) {
    await db.bosExpenditure.upsert({
      where: { id: `e2e-bos-${i}` },
      update: {},
      create: {
        id: `e2e-bos-${i}`,
        year: i <= 15 ? 2026 : 2025,
        source: ["BOS Reguler", "BOS Kinerja", "DAK"][i % 3],
        category: ["Honorarium", "Pembelajaran", "Operasional"][i % 3],
        item: `Belanja E2E ${i}`,
        amount: 1_000_000 * i,
        quarter: ((i - 1) % 4) + 1,
        recordedById: "e2e-user-admin",
      },
    });
  }
  for (let i = 1; i <= 3; i++) {
    await db.bosDocument.upsert({
      where: { id: `e2e-bosdoc-${i}` },
      update: {},
      create: {
        id: `e2e-bosdoc-${i}`,
        year: 2026,
        title: `Dokumen BOS E2E ${i}`,
        description: `Keterangan dokumen BOS E2E ${i}.`,
        fileUrl: "/uploads/e2e-placeholder.pdf",
        fileName: `e2e-bos-${i}.pdf`,
        fileSize: 1024 * i,
        uploadedById: "e2e-user-admin",
      },
    });
  }

  // ---- Dokumen publik, album + foto ----
  for (let i = 1; i <= 2; i++) {
    await db.document.upsert({
      where: { id: `e2e-doc-${i}` },
      update: {},
      create: {
        id: `e2e-doc-${i}`,
        title: `Dokumen E2E ${i}`,
        description: `Deskripsi dokumen E2E ${i}.`,
        fileUrl: "/uploads/e2e-placeholder.pdf",
        fileName: `e2e-doc-${i}.pdf`,
        fileSize: 2048 * i,
        mimeType: "application/pdf",
        category: "Akademik",
        uploadedById: "e2e-user-admin",
        isPublic: true,
      },
    });
  }
  for (let a = 1; a <= 2; a++) {
    await db.album.upsert({
      where: { id: `e2e-album-${a}` },
      update: {},
      create: {
        id: `e2e-album-${a}`,
        name: `Album E2E ${a}`,
        description: `Deskripsi album E2E ${a}.`,
        category: "Kegiatan",
        isPublished: true,
        sortOrder: a,
        createdById: "e2e-user-admin",
      },
    });
    for (let p = 1; p <= 4; p++) {
      const pid = `e2e-photo-${a}-${p}`;
      await db.photo.upsert({
        where: { id: pid },
        update: {},
        create: {
          id: pid,
          albumId: `e2e-album-${a}`,
          title: `Foto E2E ${a}-${p}`,
          url: "/img/placeholder.svg",
          thumbnailUrl: "/img/placeholder.svg",
          mimeType: "image/svg+xml",
          isFeatured: a === 1 && p === 1,
          sortOrder: p,
          uploadedById: "e2e-user-admin",
        },
      });
    }
  }

  const counts = {
    users: await db.user.count({ where: { email: { contains: "mongisidi1" } } }),
    news: await db.news.count({ where: { slug: { startsWith: "e2e-" } } }),
    bos: await db.bosExpenditure.count({ where: { id: { startsWith: "e2e-" } } }),
  };
  console.log(`✓ Seed E2E selesai — ${JSON.stringify(counts)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
