import { describe, it, expect } from "vitest";
import { handleApiCors } from "@/proxy";

const BASE = {
  method: "GET",
  proto: "https",
  host: "sdn-mongisidi1.sch.id",
  allowedOrigins: ["https://admin.sdn-mongisidi1.sch.id"],
};

describe("handleApiCors (middleware /api/*)", () => {
  it("allows requests without an Origin header (curl/server-to-server)", () => {
    const res = handleApiCors({ ...BASE, origin: null });
    expect(res).toBeNull();
  });

  it("allows same-origin requests without CORS headers", () => {
    const res = handleApiCors({
      ...BASE,
      origin: "https://sdn-mongisidi1.sch.id",
    });
    expect(res).toBeNull();
  });

  it("rejects unknown cross-origin requests with 403", () => {
    const res = handleApiCors({
      ...BASE,
      origin: "https://evil.example.com",
    });
    expect(res?.status).toBe(403);
  });

  it("rejects unknown cross-origin preflight (OPTIONS) with 403", () => {
    const res = handleApiCors({
      ...BASE,
      method: "OPTIONS",
      origin: "https://evil.example.com",
    });
    expect(res?.status).toBe(403);
  });

  it("answers preflight from an allowed origin with 204 + CORS headers", () => {
    const res = handleApiCors({
      ...BASE,
      method: "OPTIONS",
      origin: "https://admin.sdn-mongisidi1.sch.id",
    });
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://admin.sdn-mongisidi1.sch.id"
    );
    expect(res?.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res?.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain(
      "x-csrf-token"
    );
  });

  it("adds CORS headers for a real request from an allowed origin", () => {
    const res = handleApiCors({
      ...BASE,
      method: "POST",
      origin: "https://admin.sdn-mongisidi1.sch.id",
    });
    expect(res?.status).toBe(200);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://admin.sdn-mongisidi1.sch.id"
    );
    expect(res?.headers.get("Vary")).toBe("Origin");
  });

  it("does not match subdomains automatically", () => {
    const res = handleApiCors({
      ...BASE,
      origin: "https://evil.sdn-mongisidi1.sch.id",
    });
    expect(res?.status).toBe(403);
  });
});
