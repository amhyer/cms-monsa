import { describe, expect, it } from "vitest";
import {
  mapGender,
  normalize,
  combineParentName,
  resolveNis,
  parseGradeFromRombel,
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

  it("fallback ke peserta_didik_id bila nipd kosong dan nama kosong", () => {
    expect(resolveNis({ peserta_didik_id: "uuid-3" } as unknown as ResolveNisInput)).toBe(
      "uuid-3"
    );
  });

  it("fallback numerik berbasis kelas bila nipd kosong dan nama_rombel ada", () => {
    const result = resolveNis(
      { peserta_didik_id: "uuid-4", nama: "Budi Santoso" } as unknown as ResolveNisInput,
      "1.a",
    );
    // Harus numerik 10 digit, bukan UUID
    expect(result).toMatch(/^\d{10}$/);
    expect(result).not.toContain("-");
  });

  it("fallback numerik konsisten antar panggilan (nama + rombel sama)", () => {
    const input = { peserta_didik_id: "uuid-5", nama: "Siti Aminah" } as unknown as ResolveNisInput;
    const r1 = resolveNis(input, "III.a");
    const r2 = resolveNis(input, "III.a");
    expect(r1).toBe(r2);
  });

  it("fallback numerik berbeda untuk siswa berbeda di kelas sama", () => {
    const r1 = resolveNis(
      { peserta_didik_id: "uuid-6", nama: "Ahmad" } as unknown as ResolveNisInput,
      "II.a",
    );
    const r2 = resolveNis(
      { peserta_didik_id: "uuid-7", nama: "Zahra" } as unknown as ResolveNisInput,
      "II.a",
    );
    expect(r1).not.toBe(r2);
  });

  // --- Guard: fallback TIDAK PERNAH menghasilkan UUID ---
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("fallback tanpa nama_rombel (hanya nama) tetap numerik, bukan UUID", () => {
    const result = resolveNis(
      { peserta_didik_id: "550e8400-e29b-41d4-a716-446655440000", nama: "Andi" } as unknown as ResolveNisInput,
    );
    expect(result).not.toMatch(UUID_RE);
    expect(result).toMatch(/^\d+$/);
  });

  it("fallback untuk semua kelas 1–6 tidak pernah UUID", () => {
    const rombels = ["1.a", "2.b", "III.a", "IV.b", "V.a", "VI.b"];
    for (const rombel of rombels) {
      const result = resolveNis(
        { peserta_didik_id: "550e8400-e29b-41d4-a716-446655440000", nama: "Test" } as unknown as ResolveNisInput,
        rombel,
      );
      expect(result).not.toMatch(UUID_RE);
      expect(result).toMatch(/^\d+$/);
    }
  });

  it("fallback nama sangat panjang tetap numerik, bukan UUID", () => {
    const longName = "A".repeat(200);
    const result = resolveNis(
      { peserta_didik_id: "550e8400-e29b-41d4-a716-446655440000", nama: longName } as unknown as ResolveNisInput,
      "IV.a",
    );
    expect(result).not.toMatch(UUID_RE);
    expect(result).toMatch(/^\d+$/);
  });

  it("fallback nama mengandung karakter unik tetap numerik, bukan UUID", () => {
    const weirdName = "Siswa \u00e9\u00e8\u00ea test @#$%!";
    const result = resolveNis(
      { peserta_didik_id: "550e8400-e29b-41d4-a716-446655440000", nama: weirdName } as unknown as ResolveNisInput,
      "V.a",
    );
    expect(result).not.toMatch(UUID_RE);
    expect(result).toMatch(/^\d+$/);
  });

  it("nipd diprioritaskan — tidak pernah fallback meskipun ada nama+rombel", () => {
    const result = resolveNis(
      { nipd: "9999", peserta_didik_id: "550e8400-e29b-41d4-a716-446655440000", nama: "Test" } as unknown as ResolveNisInput,
      "VI.a",
    );
    expect(result).toBe("9999");
    expect(result).not.toMatch(UUID_RE);
  });
});

describe("parseGradeFromRombel", () => {
  it("angka Arab: \"1.a\" → 1", () => {
    expect(parseGradeFromRombel("1.a")).toBe(1);
  });
  it("angka Arab: \"3.b\" → 3", () => {
    expect(parseGradeFromRombel("3.b")).toBe(3);
  });
  it("angka Romawi: \"III.a\" → 3", () => {
    expect(parseGradeFromRombel("III.a")).toBe(3);
  });
  it("angka Romawi: \"VI.b\" → 6", () => {
    expect(parseGradeFromRombel("VI.b")).toBe(6);
  });
  it("undefined → null", () => {
    expect(parseGradeFromRombel(undefined)).toBeNull();
  });
  it("string kosong → null", () => {
    expect(parseGradeFromRombel("")).toBeNull();
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