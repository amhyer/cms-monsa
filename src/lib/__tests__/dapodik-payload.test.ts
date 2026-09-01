import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    student: { findMany: vi.fn() },
    teacher: { findMany: vi.fn() },
    class: { findMany: vi.fn() },
    dapodikConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { applyDapodikPayload, normalizeDapodikPayload } from "@/lib/dapodik-sync";

const payload = {
  sekolah: { nama: "SDN Tes", npsn: "40313912", alamat_jalan: "Jl. Tes" },
  siswa: [
    {
      peserta_didik_id: "pd-1",
      nama: "Budi",
      nipd: "1001",
      rombongan_belajar_id: "rb-1",
      nama_rombel: "1.a",
    },
  ],
  gtk: [{ nama: "Guru Satu", nuptk: "1234567890" }],
  rombel: [{ rombongan_belajar_id: "rb-1", nama: "1.a", tingkat_pendidikan_id_str: "1" }],
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

describe("applyDapodikPayload — dry-run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.student.findMany.mockResolvedValue([]);
    mockDb.teacher.findMany.mockResolvedValue([]);
    mockDb.class.findMany.mockResolvedValue([]);
    mockDb.dapodikConfig.findUnique.mockResolvedValue({ archiveUnlisted: true });
  });

  it("menghitung created untuk data baru", async () => {
    const result = await applyDapodikPayload(payload, "dry-run");
    expect(result.mode).toBe("dry-run");
    expect(result.siswa.created).toBe(1);
    expect(result.siswa.updated).toBe(0);
    expect(result.gtk.created).toBe(1);
    expect(result.rombel.created).toBe(1);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("menghitung updated jika dapodikId sudah ada", async () => {
    mockDb.student.findMany.mockResolvedValue([
      { id: "st-1", nis: "1001", nisn: null, dapodikId: "pd-1" },
    ]);
    mockDb.class.findMany.mockResolvedValue([
      { id: "cl-1", name: "1.a", dapodikId: "rb-1" },
    ]);
    mockDb.teacher.findMany.mockResolvedValue([
      { id: "t-1", nuptk: "1234567890", nip: null },
    ]);

    const result = await applyDapodikPayload(payload, "dry-run");
    expect(result.siswa.updated).toBe(1);
    expect(result.siswa.created).toBe(0);
    expect(result.gtk.updated).toBe(1);
    expect(result.rombel.updated).toBe(1);
  });

  it("siswa tanpa rombel dihitung errors", async () => {
    const result = await applyDapodikPayload(
      {
        ...payload,
        siswa: [{ peserta_didik_id: "pd-x", nama: "Ani" }],
      },
      "dry-run"
    );
    expect(result.siswa.errors).toBe(1);
    expect(result.siswa.created).toBe(0);
  });
});
