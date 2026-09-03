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

  // Format per-modul: { dataType, payload } — dari script Python modular.

  it("dataType=sekolah menerima objek tunggal", () => {
    const p = normalizeDapodikPayload({
      dataType: "sekolah",
      payload: { nama: "SDN Tes", npsn: "40313912" },
    });
    expect(p.sekolah.nama).toBe("SDN Tes");
    expect(p.siswa).toEqual([]);
    expect(p.archiveUnlisted).toBe(false);
  });

  it("dataType=gtk/rombel/peserta_didik memetakan ke field yang benar", () => {
    const gtk = normalizeDapodikPayload({ dataType: "gtk", payload: [{ nuptk: "1" }] });
    expect(gtk.gtk).toHaveLength(1);
    expect(gtk.siswa).toEqual([]);

    const rombel = normalizeDapodikPayload({ dataType: "rombel", payload: [{ nama: "1.a" }] });
    expect(rombel.rombel).toHaveLength(1);

    const pd = normalizeDapodikPayload({
      dataType: "peserta_didik",
      payload: [{ peserta_didik_id: "1", nama: "Budi" }],
    });
    expect(pd.siswa).toHaveLength(1);
    expect(pd.gtk).toEqual([]);
  });

  it("dataType tidak dikenal ditolak", () => {
    expect(() =>
      normalizeDapodikPayload({ dataType: "nilai", payload: [] })
    ).toThrow(/dataType/);
  });

  it("format per-modul selalu archiveUnlisted=false (anti arsip parsial)", () => {
    for (const dt of ["gtk", "rombel", "peserta_didik"]) {
      const p = normalizeDapodikPayload({ dataType: dt, payload: [{}] });
      expect(p.archiveUnlisted).toBe(false);
    }
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

  it("payload parsial (dataType) tidak menghitung sekolah.updated", async () => {
    const partial = normalizeDapodikPayload({
      dataType: "gtk",
      payload: [{ nama: "Guru Parsial", nuptk: "9999999999" }],
    });
    const result = await applyDapodikPayload(partial, "dry-run");
    expect(result.sekolah.updated).toBe(0);
    expect(result.gtk.created).toBe(1);
  });

  it("siswa modul parsial tetap butuh rombel yang sudah ada", async () => {
    // peserta_didik dikirim tanpa rombel di payload yang sama — siswa baru di
    // rombel yang belum pernah disync dihitung errors (rombel belum dikenal).
    const partial = normalizeDapodikPayload({
      dataType: "peserta_didik",
      payload: payload.siswa,
    });
    const result = await applyDapodikPayload(partial, "dry-run");
    expect(result.sekolah.updated).toBe(0);
    expect(result.siswa.created).toBe(0);
  });
});
