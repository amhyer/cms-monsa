import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, createMockUser, asNextRequest } from "../test-utils";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  hasRole: vi.fn(),
  SESSION_COOKIE: "monsa_session",
}));

vi.mock("@/lib/log", () => ({ logActivity: vi.fn() }));

import { GET } from "@/app/api/schedule/route";

const entry = {
  id: "sch-1",
  day: "Senin",
  timeSlot: 1,
  timeLabel: "07:00-07:35",
  subject: "Matematika",
  teacherId: "t-1",
  teacher: { name: "Guru A" },
  roomId: null,
  classId: "kelas-1a",
  academicYear: "2025/2026",
};

describe("GET /api/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
    mockGetSession.mockResolvedValue(null);
  });

  it("returns all entries for unauthenticated callers (existing behavior)", async () => {
    mockPrisma.scheduleEntry.findMany.mockResolvedValue([entry]);

    const req = createMockRequest("http://localhost/api/schedule?academicYear=2025/2026");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].subject).toBe("Matematika");
    expect(mockPrisma.scheduleEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { academicYear: "2025/2026" } })
    );
  });

  it("forces wali class for guru wali even when another classId is requested", async () => {
    mockGetSession.mockResolvedValue(
      createMockUser({ role: "GURU", guardianClassId: "kelas-1a" })
    );
    mockPrisma.scheduleEntry.findMany.mockResolvedValue([entry]);

    const req = createMockRequest(
      "http://localhost/api/schedule?classId=kelas-6b&academicYear=2025/2026"
    );
    const res = await GET(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockPrisma.scheduleEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classId: "kelas-1a", academicYear: "2025/2026" },
      })
    );
  });

  it("does not restrict guru mapel (no guardianClassId)", async () => {
    mockGetSession.mockResolvedValue(
      createMockUser({ role: "GURU", guardianClassId: null })
    );
    mockPrisma.scheduleEntry.findMany.mockResolvedValue([entry]);

    const req = createMockRequest("http://localhost/api/schedule");
    const res = await GET(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockPrisma.scheduleEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("does not restrict operator", async () => {
    mockGetSession.mockResolvedValue(
      createMockUser({ role: "OPERATOR", guardianClassId: "kelas-1a" })
    );
    mockPrisma.scheduleEntry.findMany.mockResolvedValue([entry]);

    const req = createMockRequest("http://localhost/api/schedule?classId=kelas-6b");
    const res = await GET(asNextRequest(req));

    expect(res.status).toBe(200);
    expect(mockPrisma.scheduleEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classId: "kelas-6b" } })
    );
  });
});
