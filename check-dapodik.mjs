import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const r = await db.dapodikConfig.findUnique({ where: { id: 'singleton' } });
console.log('DapodikConfig:', r ? 'ADA' : 'TIDAK ADA');
if (r) console.log('NPSN:', r.npsn, '| Host:', r.host, ':', r.port, '| Token:', r.token.slice(0,4)+'****'+r.token.slice(-4));
await db.$disconnect();