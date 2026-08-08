import { describe, expect, it } from "vitest";
import {
  mapGender,
  pickOrPreserve,
  resolveGrade,
  resolveGtkTarget,
  resolveParentPhone,
  tahunAjaranFromSemester,
} from "@/lib/dapodik-sync";

function cand(id: string, over: Partial<{ isActive: boolean; nuptk: string | null; nip: string | null }> = {}) {
  return { id, isActive: true, nuptk: null, nip: null, ...over };
}

function call(opts: Partial<Parameters<typeof resolveGtkTarget>[0]> = {}) {
  return resolveGtkTarget({
    identifierMatch: null,
    nameMatches: [],
    nuptk: null,
    nip: null,
    name: "USMAN",
    ...opts,
  });
}

describe("resolveGtkTarget", () => {
  it("create bila belum ada guru dengan nama itu", () => {
    expect(call({ nameMatches: [] })).toEqual({ action: "create" });
  });

  it("update (reaktivasi) bila ada tepat satu guru bernama sama (tanpa identitas)", () => {
    expect(call({ nameMatches: [cand("t1", { isActive: false })] })).toEqual({
      action: "update",
      id: "t1",
    });
  });

  it("update guru aktif bila itu satu-satunya nama yang cocok", () => {
    expect(call({ nameMatches: [cand("t1")] })).toEqual({ action: "update", id: "t1" });
  });

  it("prefer mereaktivasi guru nonaktif bila ada banyak nama sama (tanpa identitas)", () => {
    expect(
      call({
        nameMatches: [cand("aktif"), cand("nonaktif", { isActive: false })],
      })
    ).toEqual({ action: "update", id: "nonaktif" });
  });

  it("skip dengan alasan jelas bila ada beberapa guru AKTIF bernama sama (tanpa identitas)", () => {
    const d = call({ nameMatches: [cand("t1"), cand("t2")] });
    expect(d.action).toBe("skip");
    if (d.action === "skip") {
      expect(d.reason).toContain("USMAN");
      expect(d.reason).toContain("tidak bisa dibedakan");
    }
  });

  it("skip bila beberapa guru nonaktif pun sama-sama tidak bisa dibedakan", () => {
    expect(call({ nameMatches: [cand("t1", { isActive: false }), cand("t2", { isActive: false })] }).action).toBe("skip");
  });

  it("prioritas: match by NUPTK/NIP menang atas nama", () => {
    expect(
      call({
        identifierMatch: cand("by-nuptk"),
        nameMatches: [cand("by-name")],
        nuptk: "7633764665120002",
      })
    ).toEqual({ action: "update", id: "by-nuptk" });
  });

  it("guru ber-NUPTK dengan nama cocok TAPI identitas berbeda -> skip (jangan timpa)", () => {
    const d = call({
      nuptk: "7633764665120002",
      nameMatches: [cand("t1", { nuptk: "9999999999999999" })],
    });
    expect(d.action).toBe("skip");
    if (d.action === "skip") expect(d.reason).toContain("berbeda");
  });

  it("guru ber-NUPTK dengan nama cocok & identitas kosong -> update (adopsi identitas)", () => {
    expect(
      call({
        nuptk: "7633764665120002",
        nameMatches: [cand("t1")], // nuptk null
      })
    ).toEqual({ action: "update", id: "t1" });
  });

  it("nama kembar dengan identitas: pilih kandidat yang identitasnya cocok/kosong", () => {
    expect(
      call({
        nuptk: "7633764665120002",
        nameMatches: [
          cand("konflik", { nuptk: "1111111111111111" }),
          cand("bebas"),
        ],
      })
    ).toEqual({ action: "update", id: "bebas" });
  });
});

describe("mapGender", () => {
  it("memetakan L/P ke enum CMS", () => {
    expect(mapGender("L")).toBe("LAKI_LAKI");
    expect(mapGender("P")).toBe("PEREMPUAN");
    expect(mapGender(undefined)).toBeNull();
    expect(mapGender("X")).toBeNull();
  });
});

describe("resolveGrade", () => {
  it("memetakan tingkat_pendidikan_id 1..6 (SD) dan fallback", () => {
    expect(resolveGrade("1")).toBe("1");
    expect(resolveGrade("6")).toBe("6");
    expect(resolveGrade("13")).toBe("1"); // di luar rentang -> fallback
    expect(resolveGrade(undefined)).toBe("1");
    expect(resolveGrade("abc")).toBe("1");
  });
});

describe("tahunAjaranFromSemester", () => {
  it("mengubah 20261 -> 2026/2027 dan 20252 -> 2025/2026", () => {
    expect(tahunAjaranFromSemester("20261")).toBe("2026/2027");
    expect(tahunAjaranFromSemester("20252")).toBe("2025/2026");
  });

  it("fallback ke tahun berjalan untuk format tak dikenal", () => {
    const y = new Date().getFullYear();
    expect(tahunAjaranFromSemester("garbage")).toBe(`${y}/${y + 1}`);
    expect(tahunAjaranFromSemester(undefined)).toBe(`${y}/${y + 1}`);
  });
});

describe("resolveParentPhone", () => {
  it("null bila tidak ada field HP sama sekali", () => {
    expect(resolveParentPhone({})).toBeNull();
  });

  it("mengambil hp_ayah bila tersedia", () => {
    expect(
      resolveParentPhone({ hp_ayah: "081234567801", hp_ibu: "081234567802" })
    ).toBe("081234567801");
  });

  it("prioritas: ayah -> ibu -> wali -> nomor_telepon_seluler -> no_hp", () => {
    expect(resolveParentPhone({ hp_ibu: "081234567802", no_hp: "081234567803" })).toBe(
      "081234567802"
    );
    expect(resolveParentPhone({ hp_wali: "081234567803", no_hp: "081234567804" })).toBe(
      "081234567803"
    );
    expect(
      resolveParentPhone({ nomor_telepon_seluler: "085395130906", no_hp: "081234567804" })
    ).toBe("085395130906");
    expect(resolveParentPhone({ no_hp: "081234567804" })).toBe("081234567804");
  });

  it("memakai nomor_telepon_seluler (field asli versi Dapodik sekolah ini)", () => {
    expect(resolveParentPhone({ nomor_telepon_seluler: "085395130906" })).toBe(
      "085395130906"
    );
    expect(resolveParentPhone({ nomor_telepon_seluler: "0812-3456-7890" })).toBe(
      "0812-3456-7890"
    );
  });

  it("MENGABAIKAN nomor rumah (landline) karena tidak bisa menerima WhatsApp", () => {
    // Hanya ada telepon rumah -> tidak ada nomor HP -> null.
    expect(resolveParentPhone({ nomor_telepon_rumah: "04118918116" })).toBeNull();
    expect(resolveParentPhone({ telp: "0411 891 8116" })).toBeNull();
  });

  it("skip nilai tak valid dan lanjut ke field berikutnya", () => {
    expect(
      resolveParentPhone({ hp_ayah: "-", hp_ibu: "abc", no_hp: "0812-3456-7890" })
    ).toBe("0812-3456-7890");
    expect(resolveParentPhone({ hp_ayah: "  " })).toBeNull();
  });

  it("menerima format 08xx / 62xx dan men-trim spasi", () => {
    expect(resolveParentPhone({ hp_ibu: "  6281234567890 " })).toBe("6281234567890");
  });

  it("tolak nomor asing / terlalu pendek (bukan HP Indonesia)", () => {
    expect(resolveParentPhone({ hp_ayah: "+65 9123 4567" })).toBeNull();
    expect(resolveParentPhone({ hp_ayah: "12345" })).toBeNull();
  });
});

describe("pickOrPreserve", () => {
  it("pakai nilai Dapodik bila ada", () => {
    expect(pickOrPreserve("081234567890", "081111111111")).toBe("081234567890");
    expect(pickOrPreserve("Bapak Andi", null)).toBe("Bapak Andi");
  });

  it("pertahankan nilai lama bila Dapodik kosong", () => {
    expect(pickOrPreserve(null, "081111111111")).toBe("081111111111");
    expect(pickOrPreserve("", "Bapak Budi")).toBe("Bapak Budi");
    expect(pickOrPreserve("   ", "Bapak Budi")).toBe("Bapak Budi");
  });

  it("null bila keduanya kosong", () => {
    expect(pickOrPreserve(null, null)).toBeNull();
    expect(pickOrPreserve(undefined, undefined)).toBeNull();
  });
});
