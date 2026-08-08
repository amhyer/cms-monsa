import { describe, expect, it } from "vitest";
import {
  mapGender,
  normalize,
  combineParentName,
  resolveNis,
  currentAcademicYear,
  parseDate,
} from "@/lib/dapodik-sync";

describe("mapGender", () => {
  it("memetakan L/P ke enum CMS", () => {
    expect(mapGender("L")).toBe("LAKI_LAKI");
    expect(mapGender("P")).toBe("PEREMPUAN");
    expect(mapGender(undefined)).toBeNull();
    expect(mapGender("X")).toBeNull();
  });
});

describe("normalize", () => {
  it("trim dan koerce empty string ke null", () => {
    expect(normalize("  081234  ")).toBe("081234");
    expect(normalize("   ")).toBeNull();
    expect(normalize("")).toBeNull();
    expect(normalize(null)).toBeNull();
    expect(normalize(undefined)).toBeNull();
  });
});

describe("combineParentName", () => {
  it("menggabungkan nama ayah/ibu dengan pemisah", () => {
    expect(combineParentName("Andi", "Siti")).toBe("Andi / Siti");
    expect(combineParentName("Andi")).toBe("Andi");
    expect(combineParentName(undefined, "Siti")).toBe("Siti");
    expect(combineParentName(undefined, undefined)).toBeNull();
    expect(combineParentName("  ", " ")).toBeNull();
  });
});

type ResolveNisInput = Parameters<typeof resolveNis>[0];

describe("resolveNis", () => {
  it("utamakan nipd yang tidak kosong", () => {
    expect(
      resolveNis({ nipd: "1234", peserta_didik_id: "uuid-1" } as unknown as ResolveNisInput)
    ).toBe("1234");
  });

  it("toleransi nipd berupa spasi (siswa baru belum lengkap)", () => {
    expect(
      resolveNis({ nipd: "   ", peserta_didik_id: "uuid-2" } as unknown as ResolveNisInput)
    ).toBe("uuid-2");
  });

  it("fallback ke peserta_didik_id bila nipd kosong", () => {
    expect(resolveNis({ peserta_didik_id: "uuid-3" } as unknown as ResolveNisInput)).toBe(
      "uuid-3"
    );
  });
});

describe("currentAcademicYear", () => {
  it("bulan >= 7 menunjuk tahun ajaran berikutnya", () => {
    expect(currentAcademicYear()).toMatch(/^\d{4}\/\d{4}$/);
  });
});

describe("parseDate", () => {
  it("men-parse tanggal valid dan null untuk input rusak", () => {
    expect(parseDate("2024-01-15")?.getFullYear()).toBe(2024);
    expect(parseDate("bukan-tanggal")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});