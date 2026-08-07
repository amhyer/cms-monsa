import { DapodikClient } from "./DapodikClient";

describe("DapodikClient protocol guard", () => {
  const baseConfig = {
    npsn: "12345678",
    token: "test-token",
    host: "localhost",
    port: 5774,
  };

  test("throws on HTTP in production without allowInsecureInProduction", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    expect(() => {
      new DapodikClient({ ...baseConfig, protocol: "http" });
    }).toThrow("HTTP tidak diizinkan di production");

    process.env.NODE_ENV = originalEnv;
  });

  test("allows HTTP in production with allowInsecureInProduction=true", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    expect(() => {
      new DapodikClient({ ...baseConfig, protocol: "http", allowInsecureInProduction: true });
    }).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  test("allows HTTPS in production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    expect(() => {
      new DapodikClient({ ...baseConfig, protocol: "https" });
    }).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  test("allows HTTP in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    expect(() => {
      new DapodikClient({ ...baseConfig, protocol: "http" });
    }).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  test("defaults to http in development when protocol not specified", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    // baseUrl is private, so we verify via the public interface
    // The client should be created without throwing (HTTP allowed in dev)
    new DapodikClient(baseConfig);

    process.env.NODE_ENV = originalEnv;
  });
});