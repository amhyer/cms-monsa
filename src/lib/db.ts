import { PrismaClient } from '@prisma/client'
import {
  describeWriteGuard,
  isGuardedWriteAction,
  isWriteGuardActive,
  writeGuardErrorMessage,
} from '@/lib/db-write-guard'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Pengaman dev: blokir tulis ke database remote (mis. .env.local hasil
// `vercel env pull` yang menunjuk Neon produksi). Baca tetap diizinkan.
// Lihat src/lib/db-write-guard.ts. Dipasang lewat $extends (query component)
// karena client yang di-generate tidak menyediakan middleware klasik ($use).
// Cast aman: query-only extension tidak mengubah API model apa pun.
export const db: PrismaClient = isWriteGuardActive()
  ? (prisma.$extends({
      query: {
        $allOperations({ operation, args, query }) {
          if (isGuardedWriteAction(operation)) {
            throw new Error(writeGuardErrorMessage(operation))
          }
          return query(args)
        },
      },
    }) as unknown as PrismaClient)
  : prisma

if (isWriteGuardActive()) console.warn(describeWriteGuard())
