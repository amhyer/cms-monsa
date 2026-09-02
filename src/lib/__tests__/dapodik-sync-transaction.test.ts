/**
 * Tes regresi untuk perbaikan "Transaction not found" (Prisma P2028) pada
 * sinkronisasi Dapodik.
 *
 * Fake Prisma di bawah meniru perilaku interactive transaction Prisma:
 * setiap query menghabiskan waktu virtual, dan bila total waktu satu
 * transaksi melewati batas `timeout` (default Prisma 5000 ms) maka query
 * berikutnya melempar P2028 — persis error produksi yang dilaporkan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Fake Prisma ----

/** Waktu virtual (ms) yang "dihabiskan" oleh satu query di dalam transaksi. */
const QUERY_COST_MS = 20;
/** Default timeout interactive transaction Prisma bila tidak dikonfigurasi. */
const PRISMA_DEFAULT_TIMEOUT_MS = 5000;

type Row = Record<string, unknown> & { id: string };

class TransactionExpired extends Error {
  code = "P2028";
  constructor() {
    super(
      "Transaction API error: Transaction not found. Transaction ID is invalid, " +
        "refers to an old closed transaction Prisma doesn't have information about anymore, " +
        "or was obtained before disconnecting."
    );
  }
}

function createFakeDb() {
  let seq = 0;
  const nextId = (p: string) => `${p}-${++seq}`;

  const store = {
    student: [] as Row[],
    teacher: [] as Row[],
    class: [] as Row[],
    user: [] as Row[],
    siteSetting: [] as Row[],
    activityLog: [] as Row[],
    dapodikConfig: [{ id: "singleton", archiveUnlisted: true } as Row],
  };

  const stats = {
    /** opsi yang dipakai tiap panggilan $transaction */
    txOptions: [] as (Record<string, unknown> | undefined)[],
    /** jumlah query di dalam tiap transaksi */
    txQueryCounts: [] as number[],
    queries: [] as string[],
    /** transaksi yang di-rollback */
    rollbacks: 0,
  };

  /** ctx aktif; null berarti query di luar transaksi. */
  let ctx: { elapsed: number; timeout: number; count: number } | null = null;

  function tick(name: string) {
    stats.queries.push(name);
    if (!ctx) return;
    ctx.count += 1;
    ctx.elapsed += QUERY_COST_MS;
    if (ctx.elapsed > ctx.timeout) throw new TransactionExpired();
  }

  const matchWhere = (row: Row, where: Record<string, unknown> = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === "NOT") return !matchWhere(row, v as Record<string, unknown>);
      if (k === "OR") {
        return (v as Record<string, unknown>[]).some((o) => matchWhere(row, o));
      }
      if (v && typeof v === "object" && "in" in (v as object)) {
        return (v as { in: unknown[] }).in.includes(row[k]);
      }
      return row[k] === v;
    });

  function model(table: keyof typeof store, prefix: string) {
    return {
      findMany: async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, boolean> } = {}) => {
        tick(`${table}.findMany`);
        let rows = store[table].filter((r) => matchWhere(r, where ?? {}));
        if (select) {
          rows = rows.map(
            (r) => Object.fromEntries(Object.keys(select).map((k) => [k, r[k] ?? null])) as Row
          );
        }
        return rows.map((r) => ({ ...r }));
      },
      findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        tick(`${table}.findFirst`);
        const r = store[table].find((x) => matchWhere(x, where ?? {}));
        return r ? { ...r } : null;
      },
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        tick(`${table}.findUnique`);
        const r = store[table].find((x) => matchWhere(x, where));
        return r ? { ...r } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        tick(`${table}.create`);
        const row = { id: (data.id as string) ?? nextId(prefix), ...data } as Row;
        store[table].push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        tick(`${table}.update`);
        const r = store[table].find((x) => matchWhere(x, where));
        if (!r) throw new Error(`${table} not found`);
        Object.assign(r, data);
        return { ...r };
      },
      updateMany: async ({ where, data }: { where?: Record<string, unknown>; data: Record<string, unknown> }) => {
        tick(`${table}.updateMany`);
        const rows = store[table].filter((x) => matchWhere(x, where ?? {}));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      upsert: async ({ where, create, update }: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        tick(`${table}.upsert`);
        const r = store[table].find((x) => matchWhere(x, where));
        if (r) {
          Object.assign(r, update);
          return { ...r };
        }
        const row = { id: (create.id as string) ?? nextId(prefix), ...create } as Row;
        store[table].push(row);
        return { ...row };
      },
    };
  }

  const client = {
    student: model("student", "s"),
    teacher: model("teacher", "t"),
    class: model("class", "c"),
    user: model("user", "u"),
    siteSetting: model("siteSetting", "site"),
    activityLog: model("activityLog", "log"),
    dapodikConfig: model("dapodikConfig", "cfg"),
    async $transaction(fn: (tx: unknown) => Promise<unknown>, options?: Record<string, unknown>) {
      stats.txOptions.push(options);
      const timeout = (options?.timeout as number) ?? PRISMA_DEFAULT_TIMEOUT_MS;
      const prev = ctx;
      ctx = { elapsed: 0, timeout, count: 0 };
      // Snapshot untuk rollback sederhana.
      const snapshot = Object.fromEntries(
        Object.entries(store).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))])
      ) as typeof store;
      try {
        const out = await fn(client);
        stats.txQueryCounts.push(ctx.count);
        return out;
      } catch (err) {
        stats.txQueryCounts.push(ctx.count);
        stats.rollbacks += 1;
        for (const key of Object.keys(store) as (keyof typeof store)[]) {
          store[key] = snapshot[key];
        }
        throw err;
      } finally {
        ctx = prev;
      }
    },
  };

  return { client, store, stats };
}

const fake = createFakeDb();
vi.mock("@/lib/db", () => ({
  get db() {
    return fake.client;
  },
}));

import {
  applyDapodikPayload,
  chunk,
  DAPODIK_STUDENT_BATCH_SIZE,
  DAPODIK_TX_OPTIONS,
  type DapodikPayload,
} from "@/lib/dapodik-sync";

// ---- Payload realistis ----

function buildPayload(opts?: { rombel?: number; gtk?: number; siswa?: number }): DapodikPayload {
  const nRombel = opts?.rombel ?? 12;
  const nGtk = opts?.gtk ?? 30;
  const nSiswa = opts?.siswa ?? 450;

  const rombel = Array.from({ length: nRombel }, (_, i) => ({
    rombongan_belajar_id: `rb-${i + 1}`,
    nama: `${Math.floor(i / 2) + 1}.${i % 2 === 0 ? "a" : "b"}`,
    tingkat_pendidikan_id_str: String(Math.floor(i / 2) + 1),
    ptk_id_str: `Guru Wali ${i + 1}`,
  }));

  const gtk = Array.from({ length: nGtk }, (_, i) => ({
    nama: i < nRombel ? `Guru Wali ${i + 1}` : `Guru Mapel ${i + 1}`,
    nuptk: `nuptk-${i + 1}`,
    nip: `nip-${i + 1}`,
    jenis_kelamin: i % 2 === 0 ? "L" : "P",
    jabatan_ptk_id_str: i === 0 ? "Kepala Sekolah" : "Guru Kelas",
  }));

  const siswa = Array.from({ length: nSiswa }, (_, i) => {
    const r = rombel[i % nRombel];
    return {
      peserta_didik_id: `pd-${i + 1}`,
      nipd: `nis-${i + 1}`,
      nisn: `nisn-${i + 1}`,
      nama: `Siswa ${i + 1}`,
      jenis_kelamin: i % 2 === 0 ? "L" : "P",
      rombongan_belajar_id: r.rombongan_belajar_id,
      nama_rombel: r.nama,
    };
  });

  return {
    sekolah: {
      nama: "UPT SPF SD NEGERI UNGGULAN MONGISIDI 1",
      npsn: "40313912",
      alamat_jalan: "Jl. Mongisidi",
    },
    siswa,
    gtk,
    rombel,
  };
}

function resetDb() {
  fake.store.student.length = 0;
  fake.store.teacher.length = 0;
  fake.store.class.length = 0;
  fake.store.user.length = 0;
  fake.store.siteSetting.length = 0;
  fake.store.activityLog.length = 0;
  fake.store.dapodikConfig.length = 0;
  fake.store.dapodikConfig.push({ id: "singleton", archiveUnlisted: true });
  fake.stats.txOptions.length = 0;
  fake.stats.txQueryCounts.length = 0;
  fake.stats.queries.length = 0;
  fake.stats.rollbacks = 0;
}

beforeEach(resetDb);

// ---- Tes ----

describe("konfigurasi timeout transaksi", () => {
  it("mendefinisikan maxWait & timeout eksplisit di bawah batas Vercel 60s", () => {
    expect(DAPODIK_TX_OPTIONS.maxWait).toBeGreaterThan(0);
    expect(DAPODIK_TX_OPTIONS.timeout).toBeGreaterThan(PRISMA_DEFAULT_TIMEOUT_MS);
    expect(DAPODIK_TX_OPTIONS.timeout).toBeLessThan(60_000);
    expect(DAPODIK_TX_OPTIONS.maxWait + DAPODIK_TX_OPTIONS.timeout).toBeLessThan(60_000);
  });

  it("setiap $transaction commit memakai opsi timeout eksplisit", async () => {
    await applyDapodikPayload(buildPayload(), "commit", { userId: "jembatan" });
    expect(fake.stats.txOptions.length).toBeGreaterThan(0);
    for (const opt of fake.stats.txOptions) {
      expect(opt).toMatchObject({
        maxWait: DAPODIK_TX_OPTIONS.maxWait,
        timeout: DAPODIK_TX_OPTIONS.timeout,
      });
    }
  });

  it("tiap transaksi tetap jauh di bawah batas timeout-nya sendiri", async () => {
    await applyDapodikPayload(buildPayload(), "commit", { userId: "jembatan" });
    const maxQueriesAllowed = DAPODIK_TX_OPTIONS.timeout / QUERY_COST_MS;
    for (const count of fake.stats.txQueryCounts) {
      expect(count).toBeLessThan(maxQueriesAllowed);
    }
  });
});

describe("payload besar (regresi P2028)", () => {
  it("menyinkronkan 450 siswa + 30 GTK + 12 rombel tanpa Transaction not found", async () => {
    const payload = buildPayload();
    const result = await applyDapodikPayload(payload, "commit", { userId: "jembatan" });

    expect(result.mode).toBe("commit");
    expect(fake.store.student).toHaveLength(450);
    expect(fake.store.teacher).toHaveLength(30);
    expect(fake.store.class).toHaveLength(12);
    expect(result.siswa.created).toBe(450);
    expect(result.gtk.created).toBe(30);
    expect(result.rombel.created).toBe(12);
  });

  it("membagi siswa ke beberapa transaksi batch", async () => {
    await applyDapodikPayload(buildPayload({ siswa: 450 }), "commit", { userId: "jembatan" });
    // 1 transaksi header + ceil(450/batch) transaksi siswa (+0 arsip: DB kosong)
    const expectedStudentTx = Math.ceil(450 / DAPODIK_STUDENT_BATCH_SIZE);
    expect(fake.stats.txOptions.length).toBe(1 + expectedStudentTx);
  });

  it("payload besar akan gagal P2028 dengan default Prisma 5s (membuktikan fake realistis)", async () => {
    // Simulasi kondisi lama: satu transaksi panjang tanpa opsi timeout.
    await expect(
      fake.client.$transaction(async (tx: unknown) => {
        const t = tx as { teacher: { create: (a: unknown) => Promise<unknown> } };
        for (let i = 0; i < 400; i++) {
          await t.teacher.create({ data: { name: `G${i}` } });
        }
      })
    ).rejects.toMatchObject({ code: "P2028" });
  });

  it("tidak ada duplikasi saat sync dijalankan dua kali", async () => {
    const payload = buildPayload({ siswa: 120, gtk: 10, rombel: 6 });
    await applyDapodikPayload(payload, "commit", { userId: "jembatan" });
    const second = await applyDapodikPayload(payload, "commit", { userId: "jembatan" });

    expect(fake.store.student).toHaveLength(120);
    expect(fake.store.teacher).toHaveLength(10);
    expect(fake.store.class).toHaveLength(6);
    expect(second.siswa.created).toBe(0);
    expect(second.siswa.updated).toBe(120);
    expect(second.gtk.updated).toBe(10);
    expect(second.rombel.updated).toBe(6);
  });
});

describe("matching GTK & siswa", () => {
  it("mencocokkan GTK via NUPTK lalu NIP tanpa findFirst per guru", async () => {
    fake.store.teacher.push({ id: "t-existing", name: "Lama", nuptk: "nuptk-1", nip: null });
    fake.store.teacher.push({ id: "t-nip", name: "Lama NIP", nuptk: null, nip: "nip-2" });

    await applyDapodikPayload(buildPayload({ gtk: 3, rombel: 2, siswa: 4 }), "commit", {
      userId: "jembatan",
    });

    expect(fake.store.teacher).toHaveLength(3); // 2 existing di-update + 1 baru
    expect(fake.store.teacher.find((t) => t.id === "t-existing")?.name).toBe("Guru Wali 1");
    expect(fake.store.teacher.find((t) => t.id === "t-nip")?.name).toBe("Guru Wali 2");
    // Tidak lagi memakai findFirst per GTK (sumber N+1 lama).
    expect(fake.stats.queries.filter((q) => q === "teacher.findFirst")).toHaveLength(0);
  });

  it("mencocokkan siswa via peserta_didik_id lalu NIS", async () => {
    fake.store.student.push({ id: "s-pd", nis: "beda", nisn: null, dapodikId: "pd-1" });
    fake.store.student.push({ id: "s-nis", nis: "nis-2", nisn: null, dapodikId: null });

    const result = await applyDapodikPayload(
      buildPayload({ siswa: 3, rombel: 2, gtk: 2 }),
      "commit",
      { userId: "jembatan" }
    );

    expect(result.siswa.updated).toBe(2);
    expect(result.siswa.created).toBe(1);
    expect(fake.store.student).toHaveLength(3);
    expect(fake.store.student.find((s) => s.id === "s-pd")?.name).toBe("Siswa 1");
    expect(fake.store.student.find((s) => s.id === "s-nis")?.name).toBe("Siswa 2");
  });

  it("mencocokkan kelas via rombongan_belajar_id lalu nama", async () => {
    fake.store.class.push({ id: "c-dapodik", name: "lama", dapodikId: "rb-1" });
    fake.store.class.push({ id: "c-nama", name: "1.b", dapodikId: null });

    const result = await applyDapodikPayload(
      buildPayload({ rombel: 3, gtk: 2, siswa: 3 }),
      "commit",
      { userId: "jembatan" }
    );

    expect(result.rombel.updated).toBe(2);
    expect(result.rombel.created).toBe(1);
    expect(fake.store.class).toHaveLength(3);
    expect(fake.store.class.find((c) => c.id === "c-dapodik")?.name).toBe("1.a");
    expect(fake.store.class.find((c) => c.id === "c-nama")?.dapodikId).toBe("rb-2");
  });

  it("memasang wali kelas dari ptk_id_str", async () => {
    await applyDapodikPayload(buildPayload({ rombel: 2, gtk: 2, siswa: 2 }), "commit", {
      userId: "jembatan",
    });
    const kelas1 = fake.store.class.find((c) => c.dapodikId === "rb-1");
    const wali = fake.store.teacher.find((t) => t.name === "Guru Wali 1");
    expect(kelas1?.homeroomTeacherId).toBe(wali?.id);
  });
});

describe("pengarsipan", () => {
  it("hanya mengarsipkan data existing yang tidak ada di Dapodik", async () => {
    fake.store.student.push({ id: "s-hilang", nis: "lama-1", nisn: null, dapodikId: "pd-999" });
    fake.store.teacher.push({ id: "t-hilang", name: "Guru Pensiun", nuptk: "nuptk-999", nip: null });

    const result = await applyDapodikPayload(
      buildPayload({ siswa: 10, gtk: 3, rombel: 2 }),
      "commit",
      { userId: "jembatan" }
    );

    expect(result.siswa.archived).toBe(1);
    expect(result.gtk.archived).toBe(1);
    expect(fake.store.student.find((s) => s.id === "s-hilang")?.isActive).toBe(false);
    expect(fake.store.teacher.find((t) => t.id === "t-hilang")?.isActive).toBe(false);
  });

  it("tidak mengarsipkan siswa/GTK yang baru dibuat pada sync ini", async () => {
    await applyDapodikPayload(buildPayload({ siswa: 200, gtk: 20, rombel: 8 }), "commit", {
      userId: "jembatan",
    });
    expect(fake.store.student.filter((s) => s.archivedAt)).toHaveLength(0);
    expect(fake.store.teacher.filter((t) => t.archivedAt)).toHaveLength(0);
  });

  it("memakai updateMany (bukan satu update per ID) untuk pengarsipan", async () => {
    for (let i = 0; i < 50; i++) {
      fake.store.student.push({ id: `s-old-${i}`, nis: `old-${i}`, nisn: null, dapodikId: null });
    }
    await applyDapodikPayload(buildPayload({ siswa: 5, gtk: 2, rombel: 2 }), "commit", {
      userId: "jembatan",
    });
    expect(fake.store.student.filter((s) => s.isActive === false)).toHaveLength(50);
    // 50 arsip harus selesai dalam segelintir updateMany, bukan 50 update.
    expect(fake.stats.queries.filter((q) => q === "student.updateMany").length).toBeLessThanOrEqual(2);
  });

  it("menghormati archiveUnlisted=false (tidak ada yang diarsipkan)", async () => {
    fake.store.dapodikConfig[0].archiveUnlisted = false;
    fake.store.student.push({ id: "s-hilang", nis: "lama-1", nisn: null, dapodikId: null });
    fake.store.teacher.push({ id: "t-hilang", name: "Pensiun", nuptk: "nuptk-999", nip: null });

    const result = await applyDapodikPayload(
      buildPayload({ siswa: 5, gtk: 2, rombel: 2 }),
      "commit",
      { userId: "jembatan" }
    );

    expect(result.siswa.archived).toBe(0);
    expect(result.gtk.archived).toBe(0);
    expect(fake.store.student.find((s) => s.id === "s-hilang")?.isActive).toBeUndefined();
    expect(fake.store.teacher.find((t) => t.id === "t-hilang")?.isActive).toBeUndefined();
  });

  it("tidak pernah menghapus data", async () => {
    fake.store.student.push({ id: "s-hilang", nis: "lama-1", nisn: null, dapodikId: null });
    await applyDapodikPayload(buildPayload({ siswa: 5, gtk: 2, rombel: 2 }), "commit", {
      userId: "jembatan",
    });
    expect(fake.store.student.some((s) => s.id === "s-hilang")).toBe(true);
    expect(fake.stats.queries.some((q) => q.includes("delete"))).toBe(false);
  });
});

describe("dry-run", () => {
  it("tidak menulis apa pun dan hitungannya konsisten dengan commit", async () => {
    const payload = buildPayload({ siswa: 100, gtk: 10, rombel: 6 });
    const dry = await applyDapodikPayload(payload, "dry-run");

    expect(dry.mode).toBe("dry-run");
    expect(fake.store.student).toHaveLength(0);
    expect(fake.store.teacher).toHaveLength(0);
    expect(fake.stats.txOptions).toHaveLength(0);

    const commit = await applyDapodikPayload(payload, "commit", { userId: "jembatan" });
    expect(commit.siswa.created).toBe(dry.siswa.created);
    expect(commit.gtk.created).toBe(dry.gtk.created);
    expect(commit.rombel.created).toBe(dry.rombel.created);
    expect(commit.siswa.archived).toBe(dry.siswa.archived);
  });
});

describe("rollback / error handling", () => {
  it("batch yang gagal di-rollback dan error dipropagasi (tidak disembunyikan)", async () => {
    const original = fake.client.student.create;
    let calls = 0;
    fake.client.student.create = (async (args: { data: Record<string, unknown> }) => {
      calls += 1;
      if (calls === 3) throw new TransactionExpired();
      return original(args);
    }) as typeof original;

    await expect(
      applyDapodikPayload(buildPayload({ siswa: 20, gtk: 2, rombel: 2 }), "commit", {
        userId: "jembatan",
      })
    ).rejects.toMatchObject({ code: "P2028" });

    fake.client.student.create = original;
    expect(fake.stats.rollbacks).toBeGreaterThan(0);
    // Tidak ada pengarsipan yang terjadi ketika batch utama gagal.
    expect(fake.store.student.filter((s) => s.archivedAt)).toHaveLength(0);
  });

  it("pengarsipan tidak berjalan bila batch siswa gagal", async () => {
    fake.store.student.push({ id: "s-lama", nis: "lama-1", nisn: null, dapodikId: null });
    const original = fake.client.student.create;
    fake.client.student.create = (async () => {
      throw new Error("boom");
    }) as typeof original;

    await expect(
      applyDapodikPayload(buildPayload({ siswa: 10, gtk: 2, rombel: 2 }), "commit", {
        userId: "jembatan",
      })
    ).rejects.toThrow("boom");

    fake.client.student.create = original;
    expect(fake.store.student.find((s) => s.id === "s-lama")?.isActive).toBeUndefined();
  });
});

describe("chunk helper", () => {
  it("membagi array sesuai ukuran batch", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
});
