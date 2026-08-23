import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

// ── Shared mocks ──────────────────────────────────────────────
const mockRequireRole = vi.fn();
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));
vi.mock("@/lib/log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

// ── Routes under test ─────────────────────────────────────────
import { GET as teachersGET } from "@/app/api/teachers/route";
import { GET as agendaGET } from "@/app/api/agenda/route";
import { GET as achievementsGET } from "@/app/api/achievements/route";
import { GET as galleryGET } from "@/app/api/gallery/route";
import { GET as orgStructureGET } from "@/app/api/org-structure/route";
import { GET as newsGET, POST as newsPOST } from "@/app/api/news/route";
import { GET as siteSettingsGET } from "@/app/api/site-settings/route";
import { GET as studentsShowcaseGET } from "@/app/api/students/showcase/route";
import { GET as classesGET } from "@/app/api/classes/route";

// ── Helpers ───────────────────────────────────────────────────
const CACHE = {
  teachers: "public, s-maxage=300, stale-while-revalidate=600",
  agenda: "public, s-maxage=120, stale-while-revalidate=300",
  achievements: "public, s-maxage=300, stale-while-revalidate=600",
  gallery: "public, s-maxage=300, stale-while-revalidate=600",
  orgStructure: "public, s-maxage=600, stale-while-revalidate=3600",
  news: "public, s-maxage=120, stale-while-revalidate=300",
  siteSettings: "public, s-maxage=3600, stale-while-revalidate=7200",
  studentsShowcase: "public, s-maxage=300, stale-while-revalidate=600",
  classes: "public, s-maxage=300, stale-while-revalidate=600",
} as const;

/** Stub every Prisma call used by a GET handler to return empty data. */
function stubEmpty() {
  mockPrisma.teacher.findMany.mockResolvedValue([]);
  mockPrisma.agenda.findMany.mockResolvedValue([]);
  mockPrisma.achievement.count.mockResolvedValue(0);
  mockPrisma.achievement.findMany.mockResolvedValue([]);
  mockPrisma.galleryItem.count.mockResolvedValue(0);
  mockPrisma.galleryItem.findMany.mockResolvedValue([]);
  mockPrisma.orgStructure.findMany.mockResolvedValue([]);
  mockPrisma.news.count.mockResolvedValue(0);
  mockPrisma.news.findMany.mockResolvedValue([]);
  mockPrisma.siteSetting.findUnique.mockResolvedValue({
    id: "singleton", schoolName: "", npsn: "", logo: null, address: "", phone: "", email: "",
    mapEmbed: null, vision: "", mission: "", history: "", principalName: "", principalPhoto: null,
    principalWelcome: "", facebook: null, instagram: null, youtube: null, tiktok: null,
    studentCount: 0, teacherCount: 0, facilityCount: 0, achievementCount: 0,
    spmbInfo: "", spmbLink: null,
  });
  mockPrisma.student.count.mockResolvedValue(0);
  mockPrisma.student.findMany.mockResolvedValue([]);
  mockPrisma.class.findMany.mockResolvedValue([]);
}

// ── Contract ──────────────────────────────────────────────────
describe("Cache-Control headers on public GET routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    stubEmpty();
  });

  const cases: [string, () => Promise<Response>, string][] = [
    ["/api/teachers", () => teachersGET(asNextRequest(createMockRequest("http://localhost/api/teachers?scope=public"))), CACHE.teachers],
    ["/api/agenda", () => agendaGET(asNextRequest(createMockRequest("http://localhost/api/agenda"))), CACHE.agenda],
    ["/api/achievements", () => achievementsGET(asNextRequest(createMockRequest("http://localhost/api/achievements"))), CACHE.achievements],
    ["/api/gallery", () => galleryGET(asNextRequest(createMockRequest("http://localhost/api/gallery"))), CACHE.gallery],
    ["/api/org-structure", () => orgStructureGET(asNextRequest(createMockRequest("http://localhost/api/org-structure?scope=public"))), CACHE.orgStructure],
    ["/api/news?scope=public", () => newsGET(asNextRequest(createMockRequest("http://localhost/api/news?scope=public"))), CACHE.news],
    ["/api/site-settings", () => siteSettingsGET(), CACHE.siteSettings],
    ["/api/students/showcase", () => studentsShowcaseGET(asNextRequest(createMockRequest("http://localhost/api/students/showcase"))), CACHE.studentsShowcase],
    ["/api/classes", () => classesGET(asNextRequest(createMockRequest("http://localhost/api/classes?scope=public"))), CACHE.classes],
  ];

  it.each(cases)("%s returns correct Cache-Control", async (_route, handler, expected) => {
    const res = await handler();
    expect(res.headers.get("Cache-Control")).toBe(expected);
  });

  it("/api/news?scope=admin does NOT set Cache-Control", async () => {
    mockRequireAuth.mockResolvedValue({ ok: true, user: createMockUser() });
    const res = await newsGET(asNextRequest(createMockRequest("http://localhost/api/news?scope=admin")));
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("POST /api/news does NOT set Cache-Control", async () => {
    mockRequireRole.mockResolvedValue({ ok: true, user: createMockUser() });
    mockPrisma.news.findUnique.mockResolvedValue(null);
    mockPrisma.news.create.mockResolvedValue({
      id: "1", title: "Test", slug: "test", excerpt: null, content: "x",
      coverImage: null, category: "Umum", status: "DRAFT", authorId: "u1",
      publishedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await newsPOST(asNextRequest(createMockRequest("http://localhost/api/news", {
      method: "POST",
      body: { title: "Test", content: "x", category: "Umum", status: "DRAFT" },
    })));
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});
