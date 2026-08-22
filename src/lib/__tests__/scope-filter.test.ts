import { describe, it, expect } from "vitest";
import {
  computeScopeCounts,
  applyScopeFilter,
  scopeCounter,
} from "@/lib/scope-filter";

type AgendaLike = { id: string; title: string; category: string };
type ClassLike = { id: string; name: string; grade: string };

const agenda: AgendaLike[] = [
  { id: "a1", title: "Upacara", category: "Kegiatan" },
  { id: "a2", title: "UTS", category: "Akademik" },
  { id: "a3", title: "PTS", category: "Akademik" },
  { id: "a4", title: "Libur Idul Fitri", category: "Libur" },
];

const kelas: ClassLike[] = [
  { id: "c1", name: "Kelas 1A", grade: "1" },
  { id: "c2", name: "Kelas 1B", grade: "1" },
  { id: "c3", name: "Kelas 3A", grade: "3" },
];

const AGENDA_OPTIONS = ["Akademik", "Kegiatan", "Libur", "Umum"] as const;
const GRADE_OPTIONS = ["1", "2", "3", "4", "5", "6"] as const;

describe("computeScopeCounts", () => {
  it("menghitung total per scope dan all = jumlah seluruh item", () => {
    const c = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    expect(c.all).toBe(4);
    expect(c.Akademik).toBe(2);
    expect(c.Kegiatan).toBe(1);
    expect(c.Libur).toBe(1);
  });

  it("mencatat 0 untuk opsi yang tidak terpakai agar tab tetap tampil", () => {
    const c = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    expect(c.Umum).toBe(0);
  });

  it("menghitung nilai scope di luar daftar opsi yang diketahui", () => {
    const c = computeScopeCounts(kelas, "grade", GRADE_OPTIONS);
    expect(c["1"]).toBe(2);
    expect(c["3"]).toBe(1);
    expect(c["2"]).toBe(0);
    expect(c.all).toBe(3);
  });

  it("handles null/undefined values in items gracefully", () => {
    const items = [
      { id: "1", category: "A" },
      { id: "2", category: null as unknown as string },
      { id: "3", category: undefined as unknown as string },
    ];
    const c = computeScopeCounts(items, "category", ["A", "B"]);
    expect(c.all).toBe(3);
    expect(c.A).toBe(1);
    // null/undefined → String(…) → "" → counted under empty string key
    expect(c[""]).toBe(2);
  });

  it("handles items with values not in options list (first occurrence)", () => {
    // Grade "2" is in GRADE_OPTIONS but has no items initially,
    // then an item with grade "7" (outside options) tests the ?? 0 path
    const mixed = [
      { id: "1", grade: "7" },
      { id: "2", grade: "7" },
    ];
    const c = computeScopeCounts(mixed, "grade", GRADE_OPTIONS);
    expect(c["7"]).toBe(2);
    expect(c.all).toBe(2);
  });

  it("handles empty items array", () => {
    const c = computeScopeCounts([], "category", AGENDA_OPTIONS);
    expect(c.all).toBe(0);
    expect(c.Akademik).toBe(0);
  });
});

describe("applyScopeFilter", () => {
  it("mengembalikan semua item untuk 'all'", () => {
    expect(applyScopeFilter(agenda, "category", "all")).toHaveLength(4);
  });

  it("menyaring per nilai scope secara eksak", () => {
    const akademik = applyScopeFilter(agenda, "category", "Akademik");
    expect(akademik.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(applyScopeFilter(kelas, "grade", "1")).toHaveLength(2);
  });

  it("mengembalikan daftar kosong untuk scope tanpa item", () => {
    expect(applyScopeFilter(agenda, "category", "Umum")).toHaveLength(0);
  });
});

describe("scopeCounter — penyebut mengikuti tab scope aktif", () => {
  it("tab 'all' → 'X dari N label' dengan N = total seluruh item", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    expect(scopeCounter(counts, "all", agenda, "agenda")).toBe(
      "4 dari 4 agenda"
    );
  });

  it("saat tab scope aktif, penyebut = jumlah scope tersebut (bukan items.length)", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    const akademik = applyScopeFilter(agenda, "category", "Akademik");
    expect(scopeCounter(counts, "Akademik", akademik, "agenda")).toBe(
      "2 dari 2 agenda"
    );
    // Penyebut harus jumlah scope, bukan 4 (total seluruh agenda).
    expect(scopeCounter(counts, "Akademik", akademik, "agenda")).not.toContain(
      "dari 4 agenda"
    );
  });

  it("pencarian di dalam tab: pembilang menyempit, penyebut tetap total scope", () => {
    const counts = computeScopeCounts(kelas, "grade", GRADE_OPTIONS);
    // Pencarian "1B" hanya mencocokkan satu kelas grade 1.
    const searchFiltered = kelas.filter((k) => k.name.includes("1B"));
    expect(scopeCounter(counts, "1", searchFiltered, "kelas")).toBe(
      "1 dari 2 kelas"
    );
    expect(scopeCounter(counts, "1", searchFiltered, "kelas")).not.toBe(
      "1 dari 3 kelas"
    );
  });

  it("pencarian tanpa hasil di dalam tab → '0 dari <total scope>'", () => {
    const counts = computeScopeCounts(kelas, "grade", GRADE_OPTIONS);
    const noMatch = kelas.filter((k) => k.name.includes("tidak-ada"));
    expect(scopeCounter(counts, "3", noMatch, "kelas")).toBe("0 dari 1 kelas");
  });

  it("scope tanpa item → penyebut 0", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    expect(scopeCounter(counts, "Umum", [], "agenda")).toBe("0 dari 0 agenda");
  });

  it("pencarian aktif → petunjuk terpisah '· N hasil pencarian'", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    const akademik = applyScopeFilter(agenda, "category", "Akademik");
    expect(scopeCounter(counts, "Akademik", akademik, "agenda", true)).toBe(
      "2 dari 2 agenda · 2 hasil pencarian"
    );
    // Tanpa pencarian aktif, tidak ada petunjuk.
    expect(scopeCounter(counts, "Akademik", akademik, "agenda")).toBe(
      "2 dari 2 agenda"
    );
  });

  it("pencarian tanpa hasil → '0 dari N label · 0 hasil pencarian'", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    expect(scopeCounter(counts, "all", [], "agenda", true)).toBe(
      "0 dari 4 agenda · 0 hasil pencarian"
    );
  });

  it("unknown active scope → denominator defaults to 0", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    // "Tidak Ada" is not a key in counts → counts["Tidak Ada"] ?? 0 = 0
    expect(scopeCounter(counts, "Tidak Ada", [], "agenda")).toBe(
      "0 dari 0 agenda"
    );
  });

  it("unknown active scope with visible items → denominator 0, numerator matches", () => {
    const counts = computeScopeCounts(agenda, "category", AGENDA_OPTIONS);
    const items = [{ id: "x", category: "Extra" }];
    expect(scopeCounter(counts, "Nonexistent", items, "item")).toBe(
      "1 dari 0 item"
    );
  });
});
