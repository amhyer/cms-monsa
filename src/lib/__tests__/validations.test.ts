import { describe, it, expect } from "vitest";
import {
  validateBody,
  createNewsSchema,
  createUserSchema,
  createContactSchema,
  loginSchema,
  changePasswordSchema,
  createStudentSchema,
  createOrgStructureSchema,
  createBosExpenditureSchema,
  imageUrl,
} from "@/lib/validations";

describe("validateBody", () => {
  it("returns ok:true with parsed data for valid input", () => {
    const schema = createNewsSchema;
    const result = validateBody(schema, {
      title: "Test News",
      content: "Content here",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Test News");
      expect(result.data.category).toBe("Kegiatan"); // default
      expect(result.data.status).toBe("DRAFT"); // default
    }
  });

  it("returns ok:false with error message for invalid input", () => {
    const result = validateBody(createNewsSchema, { title: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("wajib diisi");
    }
  });

  it("returns first error message", () => {
    const result = validateBody(createUserSchema, {
      name: "",
      email: "invalid",
      password: "123",
    });
    expect(result.ok).toBe(false);
  });
});

describe("createNewsSchema", () => {
  it("accepts minimal valid data", () => {
    const result = createNewsSchema.safeParse({ title: "Judul", content: "Content" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createNewsSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 200 chars", () => {
    const result = createNewsSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts valid category enum", () => {
    const result = createNewsSchema.safeParse({ title: "T", content: "C", category: "Akademik" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const result = createNewsSchema.safeParse({ title: "T", content: "C", category: "Invalid" });
    expect(result.success).toBe(false);
  });
});

describe("createContactSchema", () => {
  it("accepts valid contact data", () => {
    const result = createContactSchema.safeParse({
      name: "Andi",
      email: "andi@test.com",
      subject: "Question",
      message: "Hello, I have a question about enrollment.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = createContactSchema.safeParse({
      name: "Andi",
      email: "not-an-email",
      subject: "Q",
      message: "Hello, I have a question.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty required fields", () => {
    const result = createContactSchema.safeParse({
      name: "",
      email: "a@b.com",
      subject: "",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createUserSchema", () => {
  it("accepts valid user data", () => {
    const result = createUserSchema.safeParse({
      name: "Admin",
      email: "admin@test.com",
      password: "secure123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("OPERATOR"); // default
    }
  });

  it("rejects short password", () => {
    const result = createUserSchema.safeParse({
      name: "Admin",
      email: "admin@test.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of ["SUPER_ADMIN", "OPERATOR", "GURU", "ORANG_TUA", "SISWA"]) {
      const result = createUserSchema.safeParse({
        name: "User",
        email: "u@test.com",
        password: "123456",
        role,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "password",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-email",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts valid new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old123",
      newPassword: "new123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old123",
      newPassword: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("createStudentSchema", () => {
  it("accepts valid student data", () => {
    const result = createStudentSchema.safeParse({
      nis: "NIS001",
      name: "Andi",
      classId: "c1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty NIS", () => {
    const result = createStudentSchema.safeParse({
      nis: "",
      name: "Andi",
      classId: "c1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty classId", () => {
    const result = createStudentSchema.safeParse({
      nis: "NIS001",
      name: "Andi",
      classId: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("imageUrl validator", () => {
  it("accepts empty string", () => {
    expect(imageUrl.safeParse("").success).toBe(true);
  });

  it("accepts relative path starting with /", () => {
    expect(imageUrl.safeParse("/uploads/photo.jpg").success).toBe(true);
  });

  it("accepts https URL", () => {
    expect(imageUrl.safeParse("https://example.com/photo.jpg").success).toBe(true);
  });

  it("accepts http URL", () => {
    expect(imageUrl.safeParse("http://example.com/photo.jpg").success).toBe(true);
  });

  it("rejects ftp URL", () => {
    expect(imageUrl.safeParse("ftp://example.com/photo.jpg").success).toBe(false);
  });

  it("rejects javascript URL", () => {
    expect(imageUrl.safeParse("javascript:alert(1)").success).toBe(false);
  });
});

describe("createBosExpenditureSchema", () => {
  it("accepts valid expenditure", () => {
    const result = createBosExpenditureSchema.safeParse({
      year: 2026,
      source: "BOS Reguler",
      category: "Pendidikan",
      item: "Pembelian buku",
      amount: 5000000,
      quarter: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = createBosExpenditureSchema.safeParse({
      year: 2026,
      source: "BOS",
      category: "Pendidikan",
      item: "Buku",
      amount: -1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects year before 2000", () => {
    const result = createBosExpenditureSchema.safeParse({
      year: 1999,
      source: "BOS",
      category: "Pendidikan",
      item: "Buku",
      amount: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects quarter outside 1-4", () => {
    const result = createBosExpenditureSchema.safeParse({
      year: 2026,
      source: "BOS",
      category: "Pendidikan",
      item: "Buku",
      amount: 1000,
      quarter: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("createOrgStructureSchema", () => {
  it("accepts valid org structure data", () => {
    const result = createOrgStructureSchema.safeParse({
      name: "Budi Santoso",
      position: "Kepala Sekolah",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createOrgStructureSchema.safeParse({
      name: "",
      position: "Kepala Sekolah",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty position", () => {
    const result = createOrgStructureSchema.safeParse({
      name: "Budi",
      position: "",
    });
    expect(result.success).toBe(false);
  });
});
