import { describe, it, expect } from "vitest";
import {
  computeRoleCounts,
  applyRoleFilter,
  accountCounter,
  carryStudentLink,
  type RoleFilter,
} from "@/lib/user-roles";

type UserLike = { id: string; role: string; name: string; email: string };

const users: UserLike[] = [
  { id: "1", role: "SUPER_ADMIN", name: "Admin", email: "admin@x.sch.id" },
  { id: "2", role: "OPERATOR", name: "Op Satu", email: "op1@x.sch.id" },
  { id: "3", role: "OPERATOR", name: "Op Dua", email: "op2@x.sch.id" },
  { id: "4", role: "GURU", name: "Guru Satu", email: "g1@x.sch.id" },
  { id: "5", role: "GURU", name: "Guru Dua", email: "g2@x.sch.id" },
  { id: "6", role: "ORANG_TUA", name: "Ortu Satu", email: "ortu@x.sch.id" },
  { id: "7", role: "SISWA", name: "Siswa Satu", email: "siswa@x.sch.id" },
];

describe("computeRoleCounts", () => {
  it("menghitung total per peran dan all = jumlah seluruh akun", () => {
    const c = computeRoleCounts(users);
    expect(c.all).toBe(7);
    expect(c.STAFF).toBe(3); // SUPER_ADMIN + 2 OPERATOR
    expect(c.GURU).toBe(2);
    expect(c.ORANG_TUA).toBe(1);
    expect(c.SISWA).toBe(1);
  });

  it("menghitung 0 untuk peran yang tidak ada", () => {
    const onlyGuru = users.filter((u) => u.role === "GURU");
    const c = computeRoleCounts(onlyGuru);
    expect(c.all).toBe(2);
    expect(c.STAFF).toBe(0);
    expect(c.ORANG_TUA).toBe(0);
    expect(c.SISWA).toBe(0);
  });
});

describe("applyRoleFilter", () => {
  it("mengembalikan semua akun untuk filter 'all'", () => {
    expect(applyRoleFilter(users, "all")).toHaveLength(7);
  });

  it("menggabungkan SUPER_ADMIN & OPERATOR ke STAFF", () => {
    const staff = applyRoleFilter(users, "STAFF");
    expect(staff.map((u) => u.role)).toEqual([
      "SUPER_ADMIN",
      "OPERATOR",
      "OPERATOR",
    ]);
  });

  it("menyaring per peran lain secara eksak", () => {
    expect(applyRoleFilter(users, "GURU")).toHaveLength(2);
    expect(applyRoleFilter(users, "ORANG_TUA").map((u) => u.role)).toEqual([
      "ORANG_TUA",
    ]);
    expect(applyRoleFilter(users, "SISWA").map((u) => u.id)).toEqual(["7"]);
  });
});

describe("accountCounter — penyebut mengikuti tab peran aktif", () => {
  // Signature sekarang numerik (hasil server-side): (filteredTotal, roleTotal).
  // Semantik yang diuji tetap: penyebut = total peran aktif, bukan total akun.

  it("tab 'Semua' → 'X dari N akun' dengan N = total seluruh akun", () => {
    expect(accountCounter(7, 7)).toBe("7 dari 7 akun");
  });

  it("saat tab peran aktif, penyebut = total peran tersebut (bukan total akun)", () => {
    const roleFilters: RoleFilter[] = [
      "STAFF",
      "GURU",
      "ORANG_TUA",
      "SISWA",
    ];
    for (const f of roleFilters) {
      const byRole = applyRoleFilter(users, f);
      const roleTotal = computeRoleCounts(users)[f];
      const counter = accountCounter(byRole.length, roleTotal);
      // Penyebut harus jumlah peran, bukan users.length (7).
      expect(counter).toBe(`${byRole.length} dari ${roleTotal} akun`);
      expect(counter).not.toContain("dari 7 akun");
    }
  });

  it("pencarian di dalam tab: pembilang menyempit, penyebut tetap total peran", () => {
    // Pencarian \"g1\" hanya mencocokkan satu akun GURU → filteredTotal = 1.
    expect(accountCounter(1, 2)).toBe("1 dari 2 akun");
    // Jangan pernah jatuh ke penyebut total (7) saat tab aktif.
    expect(accountCounter(1, 2)).not.toBe("1 dari 7 akun");

    // Pencarian yang tidak cocok → 0 dari <total peran>.
    expect(accountCounter(0, 1)).toBe("0 dari 1 akun");
  });

  it("pencarian di tab 'Semua' → penyebut tetap total akun", () => {
    // 2 akun cocok (Op Satu & Op Dua) dari total 7.
    expect(accountCounter(2, 7)).toBe("2 dari 7 akun");
  });

  it("pencarian aktif → petunjuk terpisah '· N hasil pencarian'", () => {
    expect(accountCounter(1, 2, true)).toBe("1 dari 2 akun · 1 hasil pencarian");
    // Tanpa pencarian aktif, tidak ada petunjuk.
    expect(accountCounter(1, 2)).toBe("1 dari 2 akun");
  });

  it("pencarian tanpa hasil → '0 dari N akun · 0 hasil pencarian'", () => {
    expect(accountCounter(0, 7, true)).toBe("0 dari 7 akun · 0 hasil pencarian");
  });
});

describe("carryStudentLink — migrasi tautan saat role diganti (mirror PUT /api/users/[id])", () => {
  it("ORANG_TUA → SISWA: guardianStudentId dipindah ke studentId", () => {
    const carried = carryStudentLink("SISWA", {
      guardianStudentId: "s1",
      studentId: "",
      guardianClassId: "",
    });
    expect(carried).toEqual({
      guardianStudentId: "",
      studentId: "s1",
      guardianClassId: "",
    });
  });

  it("SISWA → ORANG_TUA: studentId dipindah ke guardianStudentId", () => {
    const carried = carryStudentLink("ORANG_TUA", {
      guardianStudentId: "",
      studentId: "s2",
      guardianClassId: "",
    });
    expect(carried).toEqual({
      guardianStudentId: "s2",
      studentId: "",
      guardianClassId: "",
    });
  });

  it("field tujuan sudah terisi → tidak ditimpa; field lain dikosongkan (mirror route)", () => {
    // SISWA sudah punya studentId → tidak ada yang dibawa; guardianStudentId
    // dikosongkan (route: non-ORANG_TUA → guardianStudentId null).
    expect(
      carryStudentLink("SISWA", {
        guardianStudentId: "s1",
        studentId: "s2",
        guardianClassId: "",
      })
    ).toEqual({ guardianStudentId: "", studentId: "s2", guardianClassId: "" });
    expect(
      carryStudentLink("ORANG_TUA", {
        guardianStudentId: "s1",
        studentId: "s2",
        guardianClassId: "",
      })
    ).toEqual({ guardianStudentId: "s1", studentId: "", guardianClassId: "" });
  });

  it("null bila tidak ada yang berubah (role sama / field sumber kosong)", () => {
    // Tidak ada tautan untuk dibawa & tidak ada perubahan lain.
    expect(
      carryStudentLink("SISWA", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "",
      })
    ).toBeNull();
    expect(
      carryStudentLink("ORANG_TUA", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "",
      })
    ).toBeNull();
    // Memilih role yang sama → null (GURU dengan wali kelas tetap).
    expect(
      carryStudentLink("GURU", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "c1",
      })
    ).toBeNull();
    expect(
      carryStudentLink("OPERATOR", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "",
      })
    ).toBeNull();
  });

  it("keluar dari GURU → guardianClassId dikosongkan (route: non-GURU → null)", () => {
    // GURU → ORANG_TUA: wali kelas dibersihkan, tidak ada carry ke siswa.
    expect(
      carryStudentLink("ORANG_TUA", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "c1",
      })
    ).toEqual({ guardianStudentId: "", studentId: "", guardianClassId: "" });
    // GURU → SISWA: wali kelas dibersihkan.
    expect(
      carryStudentLink("SISWA", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "c1",
      })
    ).toEqual({ guardianStudentId: "", studentId: "", guardianClassId: "" });
    // GURU → OPERATOR: wali kelas dibersihkan.
    expect(
      carryStudentLink("OPERATOR", {
        guardianStudentId: "",
        studentId: "",
        guardianClassId: "c1",
      })
    ).toEqual({ guardianStudentId: "", studentId: "", guardianClassId: "" });
  });

  it("masuk GURU dari SISWA/ORANG_TUA → tautan siswa dibersihkan, kelas tetap", () => {
    // SISWA → GURU: studentId dikosongkan (route: non-SISWA → studentId null).
    expect(
      carryStudentLink("GURU", {
        guardianStudentId: "",
        studentId: "s2",
        guardianClassId: "",
      })
    ).toEqual({ guardianStudentId: "", studentId: "", guardianClassId: "" });
    // ORANG_TUA → GURU: guardianStudentId dikosongkan.
    expect(
      carryStudentLink("GURU", {
        guardianStudentId: "s1",
        studentId: "",
        guardianClassId: "",
      })
    ).toEqual({ guardianStudentId: "", studentId: "", guardianClassId: "" });
  });
});
