import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seed — tidak ada data dummy yang perlu di-seed.");
  console.log("   Database hanya berisi struktur schema dari Prisma.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
