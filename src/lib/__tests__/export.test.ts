import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * exportToCsv is a browser-only function that generates CSV and triggers download.
 * We test it by mocking the minimal DOM APIs it needs.
 */

// Capture the Blob content by intercepting URL.createObjectURL
let lastBlob: Blob | null = null;

beforeEach(() => {
  lastBlob = null;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
    lastBlob = blob as Blob;
    return "blob:test-url";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(document.body, "appendChild").mockImplementation(() => null as unknown as Node);
  vi.spyOn(document.body, "removeChild").mockImplementation((child) => child);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function getLastCsvContent(): Promise<string> {
  if (!lastBlob) throw new Error("No blob captured");
  return lastBlob.text();
}

describe("exportToCsv", () => {
  let exportToCsv: typeof import("@/lib/export").exportToCsv;

  beforeEach(async () => {
    const mod = await import("@/lib/export");
    exportToCsv = mod.exportToCsv;
  });

  it("creates a blob with CSV MIME type", () => {
    exportToCsv("test", [{ name: "Andi" }], [{ key: "name", label: "Nama" }]);
    expect(lastBlob).not.toBeNull();
    expect(lastBlob!.type).toContain("text/csv");
  });

  it("generates correct header row", async () => {
    exportToCsv("test", [{ name: "Andi" }], [{ key: "name", label: "Nama" }]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    // First line may have BOM
    const header = lines[0].charCodeAt(0) === 0xFEFF ? lines[0].slice(1) : lines[0];
    expect(header).toBe("Nama");
  });

  it("generates correct data row", async () => {
    exportToCsv("test", [{ name: "Andi", age: 10 }], [
      { key: "name", label: "Nama" },
      { key: "age", label: "Usia" },
    ]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 data row
    expect(lines[1]).toBe("Andi,10");
  });

  it("escapes commas in values", async () => {
    exportToCsv("test", [{ note: "hello, world" }], [{ key: "note", label: "Note" }]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"hello, world"');
  });

  it("escapes double quotes in values", async () => {
    exportToCsv("test", [{ note: 'say "hi"' }], [{ key: "note", label: "Note" }]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    expect(lines[1]).toBe('"say ""hi"""');
  });

  it("escapes newlines in values", async () => {
    exportToCsv("test", [{ note: "line1\nline2" }], [{ key: "note", label: "Note" }]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // header + escaped data row (2 lines due to embedded newline)
  });

  it("handles null/undefined as empty strings", async () => {
    exportToCsv("test", [{ name: "Andi", age: null }], [
      { key: "name", label: "Nama" },
      { key: "age", label: "Usia" },
    ]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Andi,");
  });

  it("prepends UTF-8 BOM for Excel", () => {
    // Verify BOM is in the blob content (Blob.text() in jsdom strips it,
    // so we check via the internal string construction instead)
    exportToCsv("test", [{ x: 1 }], [{ key: "x", label: "X" }]);
    expect(lastBlob).not.toBeNull();
    // The blob was created with BOM prefix - verify via arrayBuffer
    return lastBlob!.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      // UTF-8 BOM is EF BB BF (3 bytes)
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);
    });
  });

  it("handles empty rows array", async () => {
    exportToCsv("test", [], [{ key: "a", label: "A" }]);
    const csv = await getLastCsvContent();
    // CSV is BOM + header + "\n" + body; empty rows = BOM + header + "\n" + ""
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + empty body line
    const header = lines[0].charCodeAt(0) === 0xFEFF ? lines[0].slice(1) : lines[0];
    expect(header).toBe("A");
    expect(lines[1]).toBe(""); // empty body
  });

  it("preserves column order in output", async () => {
    exportToCsv("test", [{ z: 1, a: 2, m: 3 }], [
      { key: "m", label: "M" },
      { key: "a", label: "A" },
      { key: "z", label: "Z" },
    ]);
    const csv = await getLastCsvContent();
    const lines = csv.split("\n");
    const header = lines[0].charCodeAt(0) === 0xFEFF ? lines[0].slice(1) : lines[0];
    expect(header).toBe("M,A,Z");
    expect(lines[1]).toBe("3,2,1");
  });
});
