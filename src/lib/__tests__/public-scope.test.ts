import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  IDENTITY_FIELDS,
  PUBLIC_TEACHER_FIELDS,
  PUBLIC_TEACHER_OMIT,
  PUBLIC_ORG_STRUCTURE_FIELDS,
  PUBLIC_ORG_STRUCTURE_OMIT,
} from "@/lib/public-scope";

/**
 * Ambil daftar field (skalar + relasi) sebuah model dari prisma/schema.prisma.
 * Baris field = indentasi 2 spasi `nama  Tipe`. Direktif `@@` diabaikan.
 */
function parseModelFields(modelName: string): string[] {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8"
  );
  const block = schema.match(new RegExp(`^model ${modelName} \\{([\\s\\S]*?)^\\}`, "m"));
  if (!block) throw new Error(`Model ${modelName} tidak ditemukan di schema.`);
  const fields: string[] = [];
  for (const line of block[1].split("\n")) {
    const m = line.match(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s+/);
    if (m && !m[1].startsWith("@@")) fields.push(m[1]);
  }
  return fields;
}

const TEACHER_FIELDS = parseModelFields("Teacher");
const ORG_FIELDS = parseModelFields("OrgStructure");

describe("Kontrak scope publik — klasifikasi kolom vs prisma/schema.prisma", () => {
  it("semua kolom Teacher terklasifikasi: daftar putih ATAU omit (tidak ada yang lolos diam-diam)", () => {
    const allowlist: readonly string[] = PUBLIC_TEACHER_FIELDS;
    const omit: readonly string[] = PUBLIC_TEACHER_OMIT;
    const unclassified = TEACHER_FIELDS.filter(
      (f) => !allowlist.includes(f) && !omit.includes(f)
    );
    expect(unclassified).toEqual([]);
  });

  it("semua kolom OrgStructure terklasifikasi: daftar putih ATAU omit", () => {
    const allowlist: readonly string[] = PUBLIC_ORG_STRUCTURE_FIELDS;
    const omit: readonly string[] = PUBLIC_ORG_STRUCTURE_OMIT;
    const unclassified = ORG_FIELDS.filter(
      (f) => !allowlist.includes(f) && !omit.includes(f)
    );
    expect(unclassified).toEqual([]);
  });

  it("daftar putih dan omit tidak tumpang tindih (kolom tidak dobel-kelas)", () => {
    const teacherOverlap = PUBLIC_TEACHER_FIELDS.filter((f) =>
      (PUBLIC_TEACHER_OMIT as readonly string[]).includes(f)
    );
    expect(teacherOverlap).toEqual([]);

    const orgOverlap = PUBLIC_ORG_STRUCTURE_FIELDS.filter((f) =>
      (PUBLIC_ORG_STRUCTURE_OMIT as readonly string[]).includes(f)
    );
    expect(orgOverlap).toEqual([]);
  });

  it("setiap daftar omit hanya memuat kolom yang benar-benar ada di model", () => {
    for (const key of PUBLIC_TEACHER_OMIT) {
      expect(TEACHER_FIELDS, `omit Teacher memuat kolom tak dikenal: ${key}`).toContain(key);
    }
    for (const key of PUBLIC_ORG_STRUCTURE_OMIT) {
      expect(ORG_FIELDS, `omit OrgStructure memuat kolom tak dikenal: ${key}`).toContain(key);
    }
  });

  it("semua kolom identitas (NUPTK/NIP/NIK) wajib masuk daftar omit kedua model", () => {
    for (const key of IDENTITY_FIELDS) {
      expect(PUBLIC_TEACHER_OMIT, `Teacher harus meng-omit ${key}`).toContain(key);
      expect(PUBLIC_ORG_STRUCTURE_OMIT, `OrgStructure harus meng-omit ${key}`).toContain(key);
    }
  });

  it("kolom identitas TIDAK boleh ada di daftar putih publik", () => {
    for (const key of IDENTITY_FIELDS) {
      expect(PUBLIC_TEACHER_FIELDS, `${key} tidak boleh publik di Teacher`).not.toContain(key);
      expect(PUBLIC_ORG_STRUCTURE_FIELDS, `${key} tidak boleh publik di OrgStructure`).not.toContain(key);
    }
  });
});
