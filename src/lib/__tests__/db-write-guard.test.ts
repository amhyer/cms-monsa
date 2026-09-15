import { describe, expect, it } from "vitest";
import {
  describeWriteGuard,
  isGuardedWriteAction,
  isRemoteDatabaseHost,
  isWriteGuardActive,
  writeGuardErrorMessage,
} from "@/lib/db-write-guard";

describe("isRemoteDatabaseHost", () => {
  it.each([
    "postgresql://user:pass@ep-soft-silence-pooler.c-4.us-east-2.aws.neon.tech/db?sslmode=require",
    "postgresql://user:pass@mydb.abcdef123.us-east-1.rds.amazonaws.com:5432/db",
    "postgresql://user:pass@db.xxxxxxxxxxxx.supabase.co:5432/postgres",
    "postgres://user:pass@private-db-sgp1-1234.db.osp.digitalocean.com:25061/db",
  ])("menganggap host remote: %s", (url) => {
    expect(isRemoteDatabaseHost(url)).toBe(true);
  });

  it.each([
    "postgresql://mons:mons@localhost:5432/cms_mongisidi_dev?schema=public",
    "postgresql://postgres:postgres@127.0.0.1:55432/ci_e2e?schema=public",
    "postgresql://user:pass@host.docker.internal:5432/db",
    "postgresql://user:pass@[::1]:5432/db",
    "",
    undefined,
    "bukan-url-yang-valid",
  ])("menganggap host lokal/tak dikenal: %s", (url) => {
    expect(isRemoteDatabaseHost(url)).toBe(false);
  });
});

describe("isWriteGuardActive", () => {
  const base = {
    NODE_ENV: "development" as string | undefined,
    DATABASE_URL: "postgresql://mons:mons@localhost:5432/dev",
  };

  it("aktif di development dengan DATABASE_URL remote", () => {
    expect(
      isWriteGuardActive({
        ...base,
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms?sslmode=require",
      }),
    ).toBe(true);
  });

  it("nonaktif di development dengan DATABASE_URL lokal", () => {
    expect(isWriteGuardActive({ ...base })).toBe(false);
  });

  it("selalu nonaktif di production — bahkan dengan host remote", () => {
    expect(
      isWriteGuardActive({
        ...base,
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms?sslmode=require",
      }),
    ).toBe(false);
  });

  it("nonaktif bila ALLOW_REMOTE_DB_WRITES=1 (opt-in eksplisit)", () => {
    expect(
      isWriteGuardActive({
        ...base,
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms?sslmode=require",
        ALLOW_REMOTE_DB_WRITES: "1",
      }),
    ).toBe(false);
  });

  it("tidak menyala untuk nilai opt-in selain '1'", () => {
    expect(
      isWriteGuardActive({
        ...base,
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms?sslmode=require",
        ALLOW_REMOTE_DB_WRITES: "true",
      }),
    ).toBe(true);
  });
});

describe("isGuardedWriteAction", () => {
  it("memblokir semua aksi mutasi termasuk executeRaw", () => {
    for (const action of [
      "create",
      "createMany",
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
      "executeRaw",
    ]) {
      expect(isGuardedWriteAction(action), action).toBe(true);
    }
  });

  it("tidak memblokir operasi baca", () => {
    for (const action of ["findUnique", "findFirst", "findMany", "aggregate", "groupBy", "queryRaw", "count"]) {
      expect(isGuardedWriteAction(action), action).toBe(false);
    }
  });
});

describe("pesan error", () => {
  it("menyebut aksi dan cara keluar", () => {
    const msg = writeGuardErrorMessage("create");
    expect(msg).toContain("create");
    expect(msg).toContain("docker-compose.dev.yml");
    expect(msg).toContain("ALLOW_REMOTE_DB_WRITES=1");
  });
});

describe("describeWriteGuard", () => {
  it("menjelaskan status aktif, produksi, opt-in, dan lokal", () => {
    expect(describeWriteGuard({ NODE_ENV: "production" })).toContain("nonaktif");
    expect(
      describeWriteGuard({
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms",
      }),
    ).toContain("AKTIF");
    expect(
      describeWriteGuard({
        NODE_ENV: "development",
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.c-4.us-east-2.aws.neon.tech/cms",
        ALLOW_REMOTE_DB_WRITES: "1",
      }),
    ).toContain("ALLOW_REMOTE_DB_WRITES=1");
    expect(
      describeWriteGuard({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://mons:mons@localhost:5432/dev",
      }),
    ).toContain("lokal");
  });
});
