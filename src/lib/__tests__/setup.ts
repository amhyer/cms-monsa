import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Ensure @/lib/db is mocked globally so no test accidentally initializes PrismaClient query engine
vi.mock("@/lib/db", () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "$transaction") {
        return vi.fn(async (cb) => {
          if (typeof cb === "function") return await cb(new Proxy({}, handler));
          return cb;
        });
      }
      return new Proxy({}, {
        get() {
          return vi.fn().mockResolvedValue(null);
        },
      });
    },
  };
  return { db: new Proxy({}, handler) };
});


