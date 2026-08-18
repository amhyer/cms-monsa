import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma, mockCookies, createMockRequest, asNextRequest } from "../test-utils";

import { GET } from "@/app/api/bos-documents/route";

const doc = {
  id: "doc-1",
  year: 2026,
  title: "Output ARKAS 2026",
  description: null,
  fileUrl: "/uploads/bos-1.pdf",
  fileName: "arkas.pdf",
  fileSize: 303,
  uploadedBy: { name: "Admin" },
  uploadedById: "u-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/bos-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.store = {};
  });

  it("returns paginated items with year options and uploadedByName", async () => {
    mockPrisma.bosDocument.count.mockResolvedValue(1);
    mockPrisma.bosDocument.findMany
      .mockResolvedValueOnce([doc])
      .mockResolvedValue([{ year: 2026 }]);

    const req = createMockRequest("http://localhost/api/bos-documents");
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      id: "doc-1",
      title: "Output ARKAS 2026",
      uploadedByName: "Admin",
    });
    expect(data.items[0]).not.toHaveProperty("uploadedBy");
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.totalPages).toBe(1);
    expect(data.years).toEqual([2026]);
  });

  it("paginates with page/limit and honors ?year=", async () => {
    mockPrisma.bosDocument.count.mockResolvedValue(7);
    mockPrisma.bosDocument.findMany.mockResolvedValue([]);

    const req = createMockRequest(
      "http://localhost/api/bos-documents?year=2025&page=2&limit=5"
    );
    const res = await GET(asNextRequest(req));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(data.totalPages).toBe(2);
    expect(mockPrisma.bosDocument.count).toHaveBeenCalledWith({
      where: { year: 2025 },
    });
    expect(mockPrisma.bosDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: 2025 }, skip: 5, take: 5 })
    );
  });
});
