import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockTx } = vi.hoisted(() => {
  const tx = {
    siteSetting: { upsert: vi.fn().mockResolvedValue({}) },
    class: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: `cls-${data.name}`, ...data })),
      update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
    },
    teacher: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: `t-${data.nuptk || data.nip || Math.random()}`, ...data })),
      update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    student: {
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: `st-${data.dapodikId || data.nis}`, ...data })),
      update: vi.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const db = {
    student: { findMany: vi.fn() },
    teacher: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
    dapodikConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    activityLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === "function") {
        return await cb(tx);
      }
      return cb;
    }),
  };

  return { mockDb: db, mockTx: tx };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  applyDapodikPayload,
  normalizeDapodikPayload,
  DAPODIK_TRANSACTION_TIMEOUT_MS,
  DAPODIK_TRANSACTION_MAX_WAIT_MS,
} from "@/lib/dapodik-sync";

const basePayload = {
  sekolah: { nama: "UPT SPF SD NEGERI UNGGULAN MONGISIDI 1", npsn: "40313912", alamat_jalan: "Jl. Wr. Monginsidi No.13" },
  siswa: [
    {
      peserta_didik_id: "pd-1",
      nama: "Budi Santoso",
      nipd: "1001",
      nisn: "0012345678",
      rombongan_belajar_id: "rb-1",
      nama_rombel: "1.a",
    },
  ],
  gtk: [{ nama: "Nawawi Hamzah", nuptk: "1234567890123456", nip: "197001011990011001", jabatan_ptk_id_str: "Kepala Sekolah" }],
  rombel: [{ rombongan_belajar_id: "rb-1", nama: "1.a", tingkat_pendidikan_id_str: "1", ptk_id_str: "Nawawi Hamzah" }],
};

describe("normalizeDapodikPayload", () => {
  const sekolah = { nama: "SDN Tes", npsn: "40313912" };

  it("menerima peserta_didik sebagai alias siswa", () => {
    const p = normalizeDapodikPayload({
      sekolah,
      peserta_didik: [{ peserta_didik_id: "1", nama: "Budi" }],
      gtk: [],
      rombel: [],
    });
    expect(p.siswa).toHaveLength(1);
    expect(p.siswa[0]?.nama).toBe("Budi");
  });

  it("menolak tanpa sekolah.nama/npsn", () => {
    expect(() => normalizeDapodikPayload({ sekolah: { nama: "X" } })).toThrow(/npsn/i);
    expect(() => normalizeDapodikPayload({})).toThrow(/sekolah/i);
    expect(() => normalizeDapodikPayload(null)).toThrow(/tidak valid/i);
  });

  it("membungkus objek tunggal menjadi array", () => {
    const p = normalizeDapodikPayload({
      sekolah,
      gtk: { nama: "Guru", nuptk: "1" },
    });
    expect(p.gtk).toHaveLength(1);
    expect(p.rombel).toEqual([]);
  });
});

describe("Transaction timeout configuration", () => {
  it("menggunakan timeout dan maxWait yang aman di bawah limit Vercel 60s", () => {
    expect(DAPODIK_TRANSACTION_TIMEOUT_MS).toBeGreaterThanOrEqual(30000);
    expect(DAPODIK_TRANSACTION_TIMEOUT_MS).toBeLessThanOrEqual(55000);
    expect(DAPODIK_TRANSACTION_MAX_WAIT_MS).toBeGreaterThanOrEqual(5000);
    expect(DAPODIK_TRANSACTION_MAX_WAIT_MS).toBeLessThanOrEqual(15000);
  });
});

describe("applyDapodikPayload — dry-run & commit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.student.findMany.mockResolvedValue([]);
    mockDb.teacher.findMany.mockResolvedValue([]);
    mockDb.class.findMany.mockResolvedValue([]);
    mockDb.dapodikConfig.findUnique.mockResolvedValue({ archiveUnlisted: true });
    mockDb.dapodikConfig.upsert.mockResolvedValue({});
    mockDb.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === "function") {
        return await cb(mockTx);
      }
      return cb;
    });
  });

  it("menghitung created untuk data baru di dry-run", async () => {
    const result = await applyDapodikPayload(basePayload, "dry-run");
    expect(result.mode).toBe("dry-run");
    expect(result.siswa.created).toBe(1);
    expect(result.siswa.updated).toBe(0);
    expect(result.gtk.created).toBe(1);
    expect(result.rombel.created).toBe(1);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("menghitung updated jika dapodikId sudah ada di dry-run", async () => {
    mockDb.student.findMany.mockResolvedValue([
      { id: "st-1", nis: "1001", nisn: null, dapodikId: "pd-1" },
    ]);
    mockDb.class.findMany.mockResolvedValue([
      { id: "cl-1", name: "1.a", dapodikId: "rb-1" },
    ]);
    mockDb.teacher.findMany.mockResolvedValue([
      { id: "t-1", nuptk: "1234567890123456", nip: null },
    ]);

    const result = await applyDapodikPayload(basePayload, "dry-run");
    expect(result.siswa.updated).toBe(1);
    expect(result.siswa.created).toBe(0);
    expect(result.gtk.updated).toBe(1);
    expect(result.rombel.updated).toBe(1);
  });

  it("siswa tanpa rombel dihitung errors", async () => {
    const result = await applyDapodikPayload(
      {
        ...basePayload,
        siswa: [{ peserta_didik_id: "pd-x", nama: "Ani" }],
      },
      "dry-run"
    );
    expect(result.siswa.errors).toBe(1);
    expect(result.siswa.created).toBe(0);
  });

  it("commit mode memanggil $transaction dengan timeout eksplisit dan melakukan sinkronisasi", async () => {
    const result = await applyDapodikPayload(basePayload, "commit", { userId: "jembatan" });
    expect(result.mode).toBe("commit");
    expect(result.siswa.created).toBe(1);
    expect(result.gtk.created).toBe(1);
    expect(result.rombel.created).toBe(1);

    // Verifikasi options $transaction
    expect(mockDb.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxWait: DAPODIK_TRANSACTION_MAX_WAIT_MS,
        timeout: DAPODIK_TRANSACTION_TIMEOUT_MS,
      })
    );

    expect(mockTx.siteSetting.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.class.create).toHaveBeenCalledTimes(1);
    expect(mockTx.teacher.create).toHaveBeenCalledTimes(1);
    expect(mockTx.student.create).toHaveBeenCalledTimes(1);
  });

  it("matching GTK berdasarkan NUPTK, lalu NIP, dan tidak memanggil findFirst berulang", async () => {
    mockDb.teacher.findMany.mockResolvedValue([
      { id: "t-nuptk", name: "Guru Satu", nuptk: "99990000", nip: null },
      { id: "t-nip", name: "Guru Dua", nuptk: null, nip: "19800101" },
    ]);

    const gtkPayload = {
      ...basePayload,
      gtk: [
        { nama: "Guru Satu Updated", nuptk: "99990000" },
        { nama: "Guru Dua Updated", nip: "19800101" },
        { nama: "Guru Baru", nuptk: "88880000" },
      ],
    };

    const dryRes = await applyDapodikPayload(gtkPayload, "dry-run");
    expect(dryRes.gtk.updated).toBe(2);
    expect(dryRes.gtk.created).toBe(1);

    const commitRes = await applyDapodikPayload(gtkPayload, "commit");
    expect(commitRes.gtk.updated).toBe(2);
    expect(commitRes.gtk.created).toBe(1);

    expect(mockTx.teacher.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-nuptk" } })
    );
    expect(mockTx.teacher.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-nip" } })
    );
    expect(mockTx.teacher.create).toHaveBeenCalledTimes(1);
  });

  it("matching siswa berdasarkan peserta_didik_id, lalu NIS", async () => {
    mockDb.student.findMany.mockResolvedValue([
      { id: "st-dapodik", nis: "OLD_NIS", nisn: null, dapodikId: "pd-exist" },
      { id: "st-nis", nis: "1002", nisn: null, dapodikId: null },
    ]);

    const studentPayload = {
      ...basePayload,
      siswa: [
        // Cocok via dapodikId (walau NIPD berubah)
        { peserta_didik_id: "pd-exist", nama: "Siswa 1", nipd: "NEW_NIS", rombongan_belajar_id: "rb-1" },
        // Cocok via NIS
        { peserta_didik_id: "pd-new-id", nama: "Siswa 2", nipd: "1002", rombongan_belajar_id: "rb-1" },
        // Siswa baru
        { peserta_didik_id: "pd-brand-new", nama: "Siswa 3", nipd: "1003", rombongan_belajar_id: "rb-1" },
      ],
    };

    const dryRes = await applyDapodikPayload(studentPayload, "dry-run");
    expect(dryRes.siswa.updated).toBe(2);
    expect(dryRes.siswa.created).toBe(1);

    const commitRes = await applyDapodikPayload(studentPayload, "commit");
    expect(commitRes.siswa.updated).toBe(2);
    expect(commitRes.siswa.created).toBe(1);

    expect(mockTx.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "st-dapodik" } })
    );
    expect(mockTx.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "st-nis" } })
    );
    expect(mockTx.student.create).toHaveBeenCalledTimes(1);
  });

  it("pengarsipan hanya untuk data existing yang tidak tersinkron menggunakan updateMany", async () => {
    mockDb.student.findMany.mockResolvedValue([
      { id: "st-active-1", nis: "1001", nisn: null, dapodikId: "pd-1" },
      { id: "st-unlisted", nis: "1099", nisn: null, dapodikId: "pd-old" },
    ]);
    mockDb.teacher.findMany.mockResolvedValue([
      { id: "t-active-1", name: "Nawawi Hamzah", nuptk: "1234567890123456", nip: null },
      { id: "t-unlisted", name: "Guru Keluar", nuptk: "9999999999", nip: null },
    ]);

    const result = await applyDapodikPayload(basePayload, "commit");
    expect(result.siswa.archived).toBe(1);
    expect(result.gtk.archived).toBe(1);

    // Pengarsipan siswa & GTK memakai updateMany dalam 1 query batch
    expect(mockTx.student.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["st-unlisted"] } },
      data: { archivedAt: expect.any(Date), isActive: false },
    });
    expect(mockTx.teacher.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t-unlisted"] } },
      data: { archivedAt: expect.any(Date), isActive: false },
    });
  });

  it("data baru tidak pernah ikut terarsip", async () => {
    // Database awal kosong
    mockDb.student.findMany.mockResolvedValue([]);
    mockDb.teacher.findMany.mockResolvedValue([]);

    const result = await applyDapodikPayload(basePayload, "commit");
    expect(result.siswa.created).toBe(1);
    expect(result.siswa.archived).toBe(0);
    expect(result.gtk.created).toBe(1);
    expect(result.gtk.archived).toBe(0);

    expect(mockTx.student.updateMany).not.toHaveBeenCalled();
    expect(mockTx.teacher.updateMany).not.toHaveBeenCalled();
  });

  it("archiveUnlisted: false tidak mengarsipkan data lama", async () => {
    mockDb.dapodikConfig.findUnique.mockResolvedValue({ archiveUnlisted: false });
    mockDb.student.findMany.mockResolvedValue([
      { id: "st-unlisted", nis: "1099", nisn: null, dapodikId: "pd-old" },
    ]);
    mockDb.teacher.findMany.mockResolvedValue([
      { id: "t-unlisted", name: "Guru Keluar", nuptk: "9999999999", nip: null },
    ]);

    const dryRes = await applyDapodikPayload(basePayload, "dry-run");
    expect(dryRes.siswa.archived).toBe(0);
    expect(dryRes.gtk.archived).toBe(0);

    const commitRes = await applyDapodikPayload(basePayload, "commit");
    expect(commitRes.siswa.archived).toBe(0);
    expect(commitRes.gtk.archived).toBe(0);

    expect(mockTx.student.updateMany).not.toHaveBeenCalled();
    expect(mockTx.teacher.updateMany).not.toHaveBeenCalled();
  });

  it("rollback otomatis bila terjadi error dalam transaksi", async () => {
    mockDb.$transaction.mockRejectedValueOnce(
      new Error("Transaction API error: Transaction not found.")
    );

    await expect(applyDapodikPayload(basePayload, "commit")).rejects.toThrow(
      /Transaction not found/
    );
  });
});

describe("Realistic Large Payload (1 sekolah, 12 rombel, 30 GTK, 450 siswa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.dapodikConfig.findUnique.mockResolvedValue({ archiveUnlisted: true });
    mockDb.dapodikConfig.upsert.mockResolvedValue({});
    mockDb.$transaction.mockImplementation(async (cb) => {
      if (typeof cb === "function") {
        return await cb(mockTx);
      }
      return cb;
    });
  });

  function generateLargePayload() {
    const rombel: { rombongan_belajar_id: string; nama: string; tingkat_pendidikan_id_str: string; ptk_id_str: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      rombel.push(
        { rombongan_belajar_id: `rb-${i}a`, nama: `${i}.a`, tingkat_pendidikan_id_str: String(i), ptk_id_str: `Wali Kelas ${i}A` },
        { rombongan_belajar_id: `rb-${i}b`, nama: `${i}.b`, tingkat_pendidikan_id_str: String(i), ptk_id_str: `Wali Kelas ${i}B` }
      );
    }

    const gtk: { nama: string; nuptk: string; nip: string; jabatan_ptk_id_str: string }[] = [];
    for (let i = 1; i <= 30; i++) {
      gtk.push({
        nama: i <= 12 ? `Wali Kelas ${rombel[i - 1]?.nama.toUpperCase()}` : `Guru Mata Pelajaran ${i}`,
        nuptk: `10000000000000${String(i).padStart(2, "0")}`,
        nip: `1985010120100110${String(i).padStart(2, "0")}`,
        jabatan_ptk_id_str: i === 1 ? "Kepala Sekolah" : i <= 12 ? "Guru Kelas" : "Guru Mapel",
      });
    }

    const siswa: {
      peserta_didik_id: string;
      nama: string;
      nipd: string;
      nisn: string;
      rombongan_belajar_id: string;
      nama_rombel: string;
      jenis_kelamin: string;
      tanggal_lahir: string;
    }[] = [];
    for (let i = 1; i <= 450; i++) {
      const rombelIdx = i % 12;
      const r = rombel[rombelIdx]!;
      siswa.push({
        peserta_didik_id: `pd-guid-${i}`,
        nama: `Siswa Siswi Ke-${i}`,
        nipd: `2026${String(i).padStart(4, "0")}`,
        nisn: `00${String(i).padStart(8, "0")}`,
        rombongan_belajar_id: r.rombongan_belajar_id,
        nama_rombel: r.nama,
        jenis_kelamin: i % 2 === 0 ? "L" : "P",
        tanggal_lahir: "2018-05-15",
      });
    }

    return {
      sekolah: { nama: "UPT SPF SD NEGERI UNGGULAN MONGISIDI 1", npsn: "40313912", alamat_jalan: "Jl. Wr. Monginsidi No.13" },
      siswa,
      gtk,
      rombel,
    };
  }

  it("berhasil memproses simulasi dry-run & commit 450 siswa dan 30 GTK secara konsisten", async () => {
    const payload = generateLargePayload();

    // 200 siswa existing, 250 siswa baru, 20 siswa lama yang tidak tercantum lagi
    const existingStudents: { id: string; nis: string; nisn: string | null; dapodikId: string | null }[] = [];
    for (let i = 1; i <= 200; i++) {
      existingStudents.push({
        id: `db-st-${i}`,
        nis: `2026${String(i).padStart(4, "0")}`,
        nisn: `00${String(i).padStart(8, "0")}`,
        dapodikId: `pd-guid-${i}`,
      });
    }
    for (let i = 901; i <= 920; i++) {
      existingStudents.push({
        id: `db-st-graduated-${i}`,
        nis: `2020${String(i).padStart(4, "0")}`,
        nisn: `00${String(i).padStart(8, "0")}`,
        dapodikId: `pd-guid-old-${i}`,
      });
    }

    // 20 GTK existing, 10 GTK baru, 2 GTK lama yang tidak tercantum lagi
    const existingTeachers: { id: string; name: string; nuptk: string | null; nip: string | null }[] = [];
    for (let i = 1; i <= 20; i++) {
      existingTeachers.push({
        id: `db-t-${i}`,
        name: payload.gtk[i - 1]!.nama,
        nuptk: payload.gtk[i - 1]!.nuptk,
        nip: payload.gtk[i - 1]!.nip,
      });
    }
    existingTeachers.push(
      { id: "db-t-retired-1", name: "Guru Pensiun 1", nuptk: "99990001", nip: "19600101" },
      { id: "db-t-retired-2", name: "Guru Pensiun 2", nuptk: "99990002", nip: "19600102" }
    );

    mockDb.student.findMany.mockResolvedValue(existingStudents);
    mockDb.teacher.findMany.mockResolvedValue(existingTeachers);
    mockDb.class.findMany.mockResolvedValue([]);

    const dryResult = await applyDapodikPayload(payload, "dry-run");
    expect(dryResult.mode).toBe("dry-run");
    expect(dryResult.siswa.updated).toBe(200);
    expect(dryResult.siswa.created).toBe(250);
    expect(dryResult.siswa.archived).toBe(20);
    expect(dryResult.siswa.errors).toBe(0);

    expect(dryResult.gtk.updated).toBe(20);
    expect(dryResult.gtk.created).toBe(10);
    expect(dryResult.gtk.archived).toBe(2);
    expect(dryResult.gtk.errors).toBe(0);

    expect(dryResult.rombel.created).toBe(12);

    const commitResult = await applyDapodikPayload(payload, "commit");
    expect(commitResult.mode).toBe("commit");
    expect(commitResult.siswa.updated).toBe(200);
    expect(commitResult.siswa.created).toBe(250);
    expect(commitResult.siswa.archived).toBe(20);

    expect(commitResult.gtk.updated).toBe(20);
    expect(commitResult.gtk.created).toBe(10);
    expect(commitResult.gtk.archived).toBe(2);

    // Pastikan pengarsipan hanya memanggil updateMany 1 kali per entitas
    expect(mockTx.student.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.student.updateMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["db-st-graduated-901", "db-st-graduated-920"]) } },
      data: { archivedAt: expect.any(Date), isActive: false },
    });

    expect(mockTx.teacher.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.teacher.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["db-t-retired-1", "db-t-retired-2"] } },
      data: { archivedAt: expect.any(Date), isActive: false },
    });
  });
});
