// scripts/migrate-passwords.ts
import { db } from "../src/lib/db";
import { hashPassword, isHashed } from "../src/lib/password";
import { PrismaClient } from "@prisma/client";

// Inisialisasi Prisma Client di luar fungsi agar bisa digunakan kembali
const prisma = new PrismaClient();

async function migratePasswords() {
  console.log("Memulai migrasi password...");

  try {
    const users = await prisma.user.findMany();
    let migratedCount = 0;

    for (const user of users) {
      // Periksa apakah password perlu dimigrasi
      if (user.password && !isHashed(user.password)) {
        console.log(`Migrating password untuk pengguna: ${user.email}`);

        const hashedPassword = hashPassword(user.password);

        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });

        migratedCount++;
        console.log(`-> Password untuk ${user.email} berhasil dimigrasi.`);
      }
    }

    if (migratedCount === 0) {
      console.log("Tidak ada password yang perlu dimigrasi. Semua sudah aman.");
    } else {
      console.log(`\nMigrasi selesai. ${migratedCount} password pengguna telah di-hash.`);
    }

  } catch (error) {
    console.error("Terjadi kesalahan selama migrasi password:", error);
    process.exit(1); // Keluar dengan kode error jika terjadi kesalahan
  } finally {
    await prisma.$disconnect(); // Pastikan koneksi Prisma ditutup
  }
}

// Jalankan fungsi migrasi
migratePasswords();
