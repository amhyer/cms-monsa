/**
 * Unit test komponen UsersManager (Manajemen Akun) — adaptasi form saat role
 * akun diganti, di level UI (React Testing Library):
 *
 * 1. ORANG_TUA → SISWA: tautan siswa DIBWA dari guardianStudentId ke studentId
 *    dan nama siswa ter-resolve dari daftar siswa, sampai payload PUT.
 * 2. SISWA → GURU: field siswa hilang dan tautan basi TIDAK ikut terkirim
 *    (clearing sisi UI — field lama tidak bocor ke API).
 * 3. GURU → ORANG_TUA: field wali hilang, field anak muncul KOSONG (tidak ada
 *    carry dari tautan wali).
 *
 * Logika murni carryStudentLink() sudah diuji unit di
 * src/lib/__tests__/user-roles.test.ts; di sini kita uji sisi komponen:
 * handleRoleChange, resolusi nama siswa, dan payload simpan.
 *
 * Catatan: @/components/ui/select (Radix) di-stub jadi <select> native karena
 * interaksi pointer Radix tidak andal di jsdom; perilaku UI Radix dicakup e2e.
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Fixture + fetch router dibangun di vi.hoisted agar bisa dipakai mock factory.
const h = vi.hoisted(() => {
  const USERS = [
    {
      id: "u1",
      name: "Ortu A",
      email: "ortu.a@test.sch.id",
      role: "ORANG_TUA",
      guardianClassId: null,
      guardianStudentId: "s1",
      guardianStudentName: "Siswa A",
      guardianStudentClassName: "Kelas 1.a",
      studentId: null,
      studentName: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "u2",
      name: "Siswa B Akun",
      email: "siswa.b@test.sch.id",
      role: "SISWA",
      guardianClassId: null,
      guardianStudentId: null,
      studentId: "s2",
      studentName: "Siswa B",
      studentClassName: "Kelas 1.b",
      isActive: true,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "u3",
      name: "Guru X",
      email: "guru.x@test.sch.id",
      role: "GURU",
      guardianClassId: "c1",
      guardianClassName: "Kelas 1.a",
      guardianStudentId: null,
      studentId: null,
      isActive: true,
      createdAt: "2026-01-03T00:00:00.000Z",
    },
  ];
  const CLASSES = [{ id: "c1", name: "Kelas 1.a" }];
  const STUDENTS = [
    { id: "s1", name: "Siswa A", className: "Kelas 1.a", nis: "20260001" },
    { id: "s2", name: "Siswa B", className: "Kelas 1.b", nis: "20260002" },
  ];
  const putBodies: Record<string, unknown>[] = [];

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    if (init?.method === "PUT" && url.startsWith("/api/users/")) {
      putBodies.push(JSON.parse(String(init.body ?? "{}")));
      return json({ ok: true });
    }
    if (url.startsWith("/api/users?")) {
      return json({
        items: USERS,
        total: USERS.length,
        totalPages: 1,
        counts: { all: 3, STAFF: 0, GURU: 1, ORANG_TUA: 1, SISWA: 1 },
      });
    }
    if (url.startsWith("/api/classes")) {
      return json({ items: CLASSES });
    }
    if (url.startsWith("/api/students")) {
      return json({ items: STUDENTS });
    }
    return json({ ok: true });
  });

  return { USERS, CLASSES, STUDENTS, putBodies, fetchMock };
});

// Store zustand: hanya `user` yang dipakai komponen (untuk badge "Anda").
vi.mock("@/store/app", () => ({
  useAppStore: (selector: (s: { user: unknown }) => unknown) =>
    selector({
      user: {
        id: "admin-1",
        name: "Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Radix Select → <select> native agar interaksi (change role / wali) andal
// di jsdom. API prop dipertahankan: value + onValueChange.
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      "select",
      {
        "data-testid": "ui-select",
        value: value ?? "",
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange?.(e.target.value),
      },
      children
    );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  // Placeholder dijadikan <option value=""> agar state kosong ("") menjadi
  // nilai nyata — React tidak bisa menyetel value "" pada <select> yang tidak
  // punya option kosong (browser akan menampilkan option pertama).
  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    placeholder
      ? React.createElement("option", { value: "" }, placeholder)
      : null;
  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => React.createElement("option", { value }, children);
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

import { UsersManager } from "../users-manager";

async function openEditRow(name: RegExp) {
  // fetchList dipicu useEffect → tunggu baris muncul (bukan getByRole sinkron
  // yang masih melihat PageLoader saat efek belum jalan).
  const row = await screen.findByRole("row", { name });
  within(row).getByRole("button", { name: "Edit akun" }).click();
}

// Flush kontinuasi async (resolusi fetch → setState) di dalam act agar tidak
// memicu peringatan "update not wrapped in act(...)".
async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// Tunggu daftar siswa termuat (fetchStudents dipicu saat dialog terbuka dengan
// role ORANG_TUA/SISWA) — resolusi nama saat carry bergantung padanya.
async function waitStudentsLoaded() {
  await waitFor(() =>
    expect(h.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/students"),
      expect.anything()
    )
  );
  await flushAsync();
}

beforeEach(() => {
  h.putBodies.length = 0;
  h.fetchMock.mockClear();
  vi.stubGlobal("fetch", h.fetchMock);
});

describe("UsersManager — adaptasi form saat role akun diganti", () => {
  it("ORANG_TUA → SISWA: tautan siswa dibawa (id & nama) sampai payload simpan", async () => {
    render(<UsersManager />);
    await flushAsync(); // fetchList awal (items/loading) selesai di dalam act
    await openEditRow(/Ortu A/);
    await screen.findByRole("dialog");
    await waitStudentsLoaded();

    const roleSelect = screen.getAllByTestId("ui-select")[0];
    expect(roleSelect).toHaveValue("ORANG_TUA");
    // Field "Anak / Siswa yang Dipantau" sudah terisi nama dari data akun.
    expect(screen.getByLabelText("Anak / Siswa yang Dipantau")).toHaveValue(
      "Siswa A"
    );

    // Ganti role → SISWA: field baru muncul dan nama siswa DIBWA (carry
    // guardianStudentId → studentId, nama di-resolve dari daftar siswa).
    fireEvent.change(roleSelect, { target: { value: "SISWA" } });
    expect(screen.queryByLabelText("Anak / Siswa yang Dipantau")).toBeNull();
    const siswaField = screen.getByLabelText("Siswa Pemilik Akun");
    await waitFor(() => expect(siswaField).toHaveValue("Siswa A"));

    // Petunjuk carry muncul — auto-fill itu disengaja, bukan bug.
    expect(screen.getByText(/Tautan dibawa dari Orang Tua/)).toBeInTheDocument();

    // Admin ambil alih (ketik manual) → petunjuk hilang; pilih lagi dari
    // typeahead agar tautan terpasang kembali, lalu simpan.
    // (Nilai harus BEDA dari nilai saat ini — React melewati onChange bila
    // nilai tidak berubah, jadi ketik "Siswa" dulu.)
    fireEvent.change(siswaField, { target: { value: "Siswa" } });
    expect(screen.queryByText(/Tautan dibawa dari Orang Tua/)).toBeNull();
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Siswa A/ }));
    await waitFor(() => expect(siswaField).toHaveValue("Siswa A"));

    // Simpan → payload PUT membawa role SISWA + studentId, tanpa field basi.
    await act(async () => {
      await screen.getByRole("button", { name: "Simpan" }).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(h.putBodies).toHaveLength(1));
    await flushAsync(); // dialog menutup (Presence Radix) di dalam act
    const body = h.putBodies[0];
    expect(body.role).toBe("SISWA");
    expect(body.studentId).toBe("s1");
    expect(body).not.toHaveProperty("guardianStudentId");
    expect(body).not.toHaveProperty("guardianClassId");
  });

  it("SISWA → GURU: field siswa hilang & tautan basi tidak ikut terkirim", async () => {
    render(<UsersManager />);
    await flushAsync(); // fetchList awal selesai di dalam act
    await openEditRow(/Siswa B Akun/);
    await screen.findByRole("dialog");
    await waitStudentsLoaded();

    let selects = screen.getAllByTestId("ui-select");
    expect(selects[0]).toHaveValue("SISWA");
    expect(screen.getByLabelText("Siswa Pemilik Akun")).toHaveValue("Siswa B");

    // Ganti role → GURU: field siswa hilang, muncul Wali Kelas (kosong).
    fireEvent.change(selects[0], { target: { value: "GURU" } });
    expect(screen.queryByLabelText("Siswa Pemilik Akun")).not.toBeInTheDocument();
    selects = screen.getAllByTestId("ui-select");
    expect(selects).toHaveLength(2); // role + wali kelas
    await screen.findByRole("option", { name: "Kelas 1.a" });
    expect(selects[1]).toHaveValue("");

    fireEvent.change(selects[1], { target: { value: "c1" } });
    await act(async () => {
      await screen.getByRole("button", { name: "Simpan" }).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(h.putBodies).toHaveLength(1));
    await flushAsync();
    const body = h.putBodies[0];
    expect(body.role).toBe("GURU");
    expect(body.guardianClassId).toBe("c1");
    // Tautan basi dari role SISWA tidak bocor ke API (clearing sisi UI).
    expect(body).not.toHaveProperty("studentId");
    expect(body).not.toHaveProperty("guardianStudentId");
  });

  it("GURU → ORANG_TUA → GURU: wali kelas tidak basi (dikosongkan saat keluar GURU)", async () => {
    render(<UsersManager />);
    await flushAsync(); // fetchList awal selesai di dalam act
    await openEditRow(/Guru X/);
    await screen.findByRole("dialog");

    let selects = screen.getAllByTestId("ui-select");
    expect(selects[0]).toHaveValue("GURU");
    await screen.findByRole("option", { name: "Kelas 1.a" });
    expect(selects[1]).toHaveValue("c1"); // wali ter-prefill dari data akun

    // GURU → ORANG_TUA: wali hilang; anak muncul KOSONG karena tidak ada
    // tautan siswa untuk dibawa; tanpa petunjuk "tautan dibawa".
    fireEvent.change(selects[0], { target: { value: "ORANG_TUA" } });
    selects = screen.getAllByTestId("ui-select");
    expect(selects).toHaveLength(1);
    const anak = screen.getByLabelText("Anak / Siswa yang Dipantau");
    expect(anak).toHaveValue("");
    expect(screen.queryByText(/Tautan dibawa dari/)).toBeNull();

    // ORANG_TUA → GURU lagi: wali kelas muncul KOSONG — guardianClassId basi
    // sudah dimigrasi (dikosongkan) saat keluar GURU, mirror PUT route yang
    // menetapkan null untuk role non-GURU.
    fireEvent.change(selects[0], { target: { value: "GURU" } });
    selects = screen.getAllByTestId("ui-select");
    expect(selects).toHaveLength(2);
    await screen.findByRole("option", { name: "Kelas 1.a" });
    expect(selects[1]).toHaveValue("");

    // Pilih wali kelas lalu simpan → payload GURU dengan guardianClassId.
    fireEvent.change(selects[1], { target: { value: "c1" } });
    await act(async () => {
      await screen.getByRole("button", { name: "Simpan" }).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(h.putBodies).toHaveLength(1));
    const body = h.putBodies[0];
    expect(body.role).toBe("GURU");
    expect(body.guardianClassId).toBe("c1");
  });
});
