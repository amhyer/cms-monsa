import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, createMockRequest, asNextRequest } from "../test-utils";

import { GET } from "@/app/api/students/showcase/route";

describe("GET /api/students/showcase (public)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe projection without auth", async () => {
    const row = {
      id: "s1",
      name: "Ani",
      photoUrl: "https://example.com/ani.jpg",
      nis: "12345",
      class: { name: "1A" },
    };
    mockPrisma.student.count.mockResolvedValue(1);
    mockPrisma.student.findMany.mockResolvedValue([row]);

    const req = createMockRequest("http://localhost/api/students/showcase");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toEqual({
      id: "s1",
      name: "Ani",
      photoUrl: "https://example.com/ani.jpg",
      className: "1A",
    });
    // NIS/NISN tidak boleh bocor ke publik.
    expect(data.items[0].nis).toBeUndefined();
  });

  it("filters by classId and search query", async () => {
    mockPrisma.student.count.mockResolvedValue(0);
    mockPrisma.student.findMany.mockResolvedValue([]);

    const req = createMockRequest(
      "http://localhost/api/students/showcase?classId=c1&q=Ani"
    );
    await GET(asNextRequest(req));

    expect(mockPrisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          classId: "c1",
          OR: expect.any(Array),
        }),
      })
    );
  });
});