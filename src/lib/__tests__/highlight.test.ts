import { describe, it, expect } from "vitest";
import { splitMatches } from "@/lib/highlight";

describe("splitMatches", () => {
  it("query kosong → satu bagian tanpa match", () => {
    expect(splitMatches("Bima Arya Saputra", "")).toEqual([
      { text: "Bima Arya Saputra", match: false },
    ]);
    expect(splitMatches("Bima Arya Saputra", "   ")).toEqual([
      { text: "Bima Arya Saputra", match: false },
    ]);
  });

  it("tanpa kecocokan → satu bagian tanpa match", () => {
    expect(splitMatches("Bima Arya Saputra", "zebra")).toEqual([
      { text: "Bima Arya Saputra", match: false },
    ]);
  });

  it("kecocokan di tengah → bagian sebelum/sesudah tidak di-highlight", () => {
    expect(splitMatches("Orang tua Aisyah Putri Ramadhani", "aisyah")).toEqual([
      { text: "Orang tua ", match: false },
      { text: "Aisyah", match: true },
      { text: " Putri Ramadhani", match: false },
    ]);
  });

  it("kecocokan di awal dan akhir teks", () => {
    expect(splitMatches("Bima Arya", "bima")).toEqual([
      { text: "Bima", match: true },
      { text: " Arya", match: false },
    ]);
    expect(splitMatches("Bima Arya", "arya")).toEqual([
      { text: "Bima ", match: false },
      { text: "Arya", match: true },
    ]);
  });

  it("semua kemunculan di-highlight (case-insensitive)", () => {
    expect(splitMatches("Anak: Aisyah (Aisyah Putri)", "aisyah")).toEqual([
      { text: "Anak: ", match: false },
      { text: "Aisyah", match: true },
      { text: " (", match: false },
      { text: "Aisyah", match: true },
      { text: " Putri)", match: false },
    ]);
  });

  it("karakter regex khusus diperlakukan literal (mis. '1.a')", () => {
    expect(splitMatches("Kelas: Kelas 1.a", "1.a")).toEqual([
      { text: "Kelas: Kelas ", match: false },
      { text: "1.a", match: true },
    ]);
    // Titik tidak boleh dicocokkan sebagai wildcard.
    expect(splitMatches("Kelas: Kelas 1xa", "1.a")).toEqual([
      { text: "Kelas: Kelas 1xa", match: false },
    ]);
  });

  it("teks kosong aman", () => {
    expect(splitMatches("", "abc")).toEqual([{ text: "", match: false }]);
  });
});
