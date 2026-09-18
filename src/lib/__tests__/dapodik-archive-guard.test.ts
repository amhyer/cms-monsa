/**
 * Tes pagar pengaman `archiveDapodikUnlisted` (temuan review H2).
 *
 * Fungsi ini mengarsipkan semua siswa/guru yang TIDAK muncul di daftar kiriman
 * jembatan Dapodik. Sebelum perbaikan, payload kosong atau terpotong akan
 * menonaktifkan SELURUH data aktif dalam satu request — dan jembatan sudah
 * pernah crash di produksi (lihat branch merge-pr9-dapodik-bridge-crash).
 *
 * Fake Prisma di sini sengaja minimal dan terpisah dari
 * dapodik-sync-transaction.test.ts: fake itu menyamakan `undefined` dengan
 * `null` secara salah untuk `where: { archivedAt: null }`, sedangkan di sinilah
 * tepatnya filter "masih aktif" diuji.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string };

function createFakeDb() {
  const store = {
    student: [] as Row[],
    teacher: [] as Row[],
  };
  const calls: string[] = [];

  const matchWhere = (row: Row, where: Record<string, unknown> = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in (v as object)) {
        return (v as { in: unknown[] }).in.includes(row[k]);
      }
      // Prisma memperlakukan `where: { col: null }` sebagai "IS NULL".
      // Baris yang belum pernah menyetel kolom itu harus ikut cocok.
      if (v === null) return row[k] === null || row[k] === undefined;
      return row[k] === v;
    });

  function model(table: keyof typeof store) {
    return {
      findMany: async ({
        where,
        select,
      }: { where?: Record<string, unknown>; select?: Record<string, boolean> } = {}) => {
        calls.push(`${table}.findMany`);
        let rows = store[table].filter((r) => matchWhere(r, where ?? {}));
        if (select) {
          rows = rows.map(
            (r) =>
              Object.fromEntries(
                Object.keys(select).map((k) => [k, r[k] ?? null])
              ) as Row
          );
        }
        return rows.map((r) => ({ ...r }));
      },
      updateMany: async ({
        where,
        data,
      }: { where?: Record<string, unknown>; data: Record<string, unknown> }) => {
        calls.push(`${table}.updateMany`);
        const rows = store[table].filter((x) => matchWhere(x, where ?? {}));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    };
  }

  const client = {
    student: model("student"),
    teacher: model("teacher"),
    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      calls.push("$transaction");
      return fn(client);
    },
  };

  return { client, store, calls };
}

const fake = createFakeDb();
vi.mock("@/lib/db", () => ({
  get db() {
    return fake.client;
  },
}));

import {
  archiveDapodikUnlisted,
  ArchiveSafetyError,
  ARCHIVE_MAX_RATIO,
} from "@/lib/dapodik-sync";

/** Isi store dengan `n` siswa aktif ber-dapodikId dan `m` guru aktif ber-NUPTK. */
function seed(nStudents: number, nTeachers: number) {
  fake.store.student.length = 0;
  fake.store.teacher.length = 0;
  for (let i = 0; i < nStudents; i++) {
    fake.store.student.push({
      id: `s-${i}`,
      dapodikId: `pd-${i}`,
      archivedAt: null,
      isActive: true,
    });
  }
  for (let i = 0; i < nTeachers; i++) {
    fake.store.teacher.push({
      id: `t-${i}`,
      nuptk: `nuptk-${i}`,
      nip: null,
      archivedAt: null,
      isActive: true,
    });
  }
}

const allPdIds = (n: number) => Array.from({ length: n }, (_, i) => `pd-${i}`);
const allNuptk = (n: number) => Array.from({ length: n }, (_, i) => `nuptk-${i}`);

beforeEach(() => {
  fake.calls.length = 0;
});

describe("archiveDapodikUnlisted — pagar pengaman (H2)", () => {
  it("MENOLAK daftar pesertaDidik kosong padahal masih ada siswa aktif", async () => {
    seed(10, 5);
    await expect(
      archiveDapodikUnlisted({ pesertaDidikIds: [], gtkIds: allNuptk(5) })
    ).rejects.toThrow(ArchiveSafetyError);

    // Tidak ada satu pun siswa yang boleh tersentuh.
    expect(fake.store.student.every((s) => s.isActive === true)).toBe(true);
    expect(fake.store.student.every((s) => s.archivedAt === null)).toBe(true);
    expect(fake.calls).not.toContain("$transaction");
  });

  it("MENOLAK daftar gtk kosong padahal masih ada guru aktif", async () => {
    seed(10, 5);
    await expect(
      archiveDapodikUnlisted({ pesertaDidikIds: allPdIds(10), gtkIds: [] })
    ).rejects.toThrow(ArchiveSafetyError);
    expect(fake.store.teacher.every((t) => t.isActive === true)).toBe(true);
  });

  it("force:true TIDAK bisa melewati penolakan daftar kosong", async () => {
    seed(10, 5);
    // Tidak ada skenario sah di mana jembatan melaporkan "nol siswa".
    await expect(
      archiveDapodikUnlisted({
        pesertaDidikIds: [],
        gtkIds: allNuptk(5),
        force: true,
      })
    ).rejects.toThrow(ArchiveSafetyError);
    expect(fake.store.student.every((s) => s.isActive === true)).toBe(true);
  });

  it("MENOLAK arsip di atas ambang rasio tanpa force", async () => {
    seed(100, 10);
    // Hanya mengirim 50 dari 100 siswa → 50% akan terarsip, jauh di atas 10%.
    await expect(
      archiveDapodikUnlisted({
        pesertaDidikIds: allPdIds(50),
        gtkIds: allNuptk(10),
      })
    ).rejects.toThrow(ArchiveSafetyError);

    expect(fake.store.student.every((s) => s.isActive === true)).toBe(true);
    expect(fake.calls).not.toContain("$transaction");
  });

  it("mengizinkan arsip di atas ambang dengan force:true", async () => {
    seed(100, 10);
    const result = await archiveDapodikUnlisted({
      pesertaDidikIds: allPdIds(50),
      gtkIds: allNuptk(10),
      force: true,
    });
    expect(result.siswaArchived).toBe(50);
    expect(result.gtkArchived).toBe(0);
  });

  it("mengizinkan arsip di bawah ambang tanpa force (pergantian semester normal)", async () => {
    seed(100, 20);
    // 5 siswa lulus dari 100 = 5%, di bawah ARCHIVE_MAX_RATIO.
    const ids = allPdIds(95);
    const result = await archiveDapodikUnlisted({
      pesertaDidikIds: ids,
      gtkIds: allNuptk(20),
    });
    expect(result.siswaArchived).toBe(5);
    expect(result.gtkArchived).toBe(0);
    expect(5 / 100).toBeLessThanOrEqual(ARCHIVE_MAX_RATIO);

    const archived = fake.store.student.filter((s) => s.isActive === false);
    expect(archived).toHaveLength(5);
    // archivedAt harus terisi timestamp, bukan tetap null.
    expect(archived.every((s) => s.archivedAt instanceof Date)).toBe(true);
  });

  it("database kosong + daftar kosong bukan error (tidak ada yang perlu diarsip)", async () => {
    seed(0, 0);
    const result = await archiveDapodikUnlisted({
      pesertaDidikIds: [],
      gtkIds: [],
    });
    expect(result).toEqual({ siswaArchived: 0, gtkArchived: 0 });
  });

  it("guru tanpa NUPTK & NIP tidak pernah ikut terarsip", async () => {
    seed(10, 2);
    // Tambahkan guru yang tidak punya kunci pencocokan sama sekali.
    fake.store.teacher.push({
      id: "t-manual",
      nuptk: null,
      nip: null,
      archivedAt: null,
      isActive: true,
    });

    // Hapus 1 guru dari daftar → 1 dari 3 = 33%, di atas ambang. Pakai force
    // agar yang diuji adalah aturan pencocokan, bukan pagar rasio.
    await archiveDapodikUnlisted({
      pesertaDidikIds: allPdIds(10),
      gtkIds: allNuptk(1),
      force: true,
    });

    expect(fake.store.teacher.find((t) => t.id === "t-manual")?.isActive).toBe(
      true
    );
    // nuptk-0 masih ada di daftar → tetap aktif; nuptk-1 tidak → terarsip.
    expect(fake.store.teacher.find((t) => t.id === "t-0")?.isActive).toBe(true);
    expect(fake.store.teacher.find((t) => t.id === "t-1")?.isActive).toBe(false);
  });

  it("menjalankan arsip siswa & guru dalam SATU transaksi (atomik)", async () => {
    seed(100, 20);
    await archiveDapodikUnlisted({
      pesertaDidikIds: allPdIds(99),
      gtkIds: allNuptk(19),
    });
    expect(fake.calls.filter((c) => c === "$transaction")).toHaveLength(1);
  });
});
