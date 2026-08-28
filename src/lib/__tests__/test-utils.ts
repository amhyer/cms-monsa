import { vi } from "vitest";
import type { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/types";

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  news: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  announcement: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  agenda: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  teacher: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  galleryItem: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  achievement: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  complaint: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  contactMessage: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  class: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  attendance: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    groupBy: vi.fn(),
  },
  siteSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  orgStructure: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  bosExpenditure: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  bosDocument: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn().mockResolvedValue([]),
  },
  uploadedFile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  schoolAnnouncement: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  $transaction: vi.fn((calls: unknown[]) => Promise.resolve(calls)),
};

vi.mock("@/lib/db", () => ({
  db: mockPrisma,
}));

// Mock next/headers
const mockCookies = {
  store: {} as Record<string, string>,
  get: vi.fn((name: string) => ({
    value: mockCookies.store[name] || "",
    name,
  })),
  set: vi.fn((name: string, value: string) => {
    mockCookies.store[name] = value;
  }),
  delete: vi.fn((name: string) => {
    delete mockCookies.store[name];
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

// Mock logActivity to avoid DB writes in tests
vi.mock("@/lib/log", () => ({
  logActivity: vi.fn(() => Promise.resolve()),
}));

// Mock CSRF - always pass validation in tests
vi.mock("@/lib/csrf", () => ({
  generateCsrfToken: vi.fn(() => Promise.resolve("mock-csrf-token")),
  getCsrfToken: vi.fn(() => Promise.resolve("mock-csrf-token")),
  validateCsrfToken: vi.fn(() => Promise.resolve(true)),
  requireCsrf: vi.fn(() => Promise.resolve(null)),
}));

export { mockPrisma, mockCookies };

// Helper to create mock request
export function createMockRequest(
  url: string,
  options: Omit<RequestInit, "body"> & { method?: string; body?: unknown } = {}
): Request {
  const { method = "GET", body, headers = {}, ...rest } = options;
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  }) as unknown as Request;
}

// Helper to create mock SessionUser
export function createMockUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    role: "SUPER_ADMIN",
    isActive: true,
    mustChangePassword: false,
    guardianClassId: null,
    guardianStudentId: null,
    ...overrides,
  };
}

// Cast a plain Request to NextRequest for route handlers in tests.
export function asNextRequest(req: Request): NextRequest {
  return req as unknown as NextRequest;
}
