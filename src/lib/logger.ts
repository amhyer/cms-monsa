import pino from "pino";

/**
 * Structured logger for CMS MONSA.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId: "u1", action: "CREATE" }, "User created");
 *   logger.error({ err, requestId }, "Something failed");
 *
 * In development, logs are pretty-printed. In production, they're JSON.
 * When LOKI_URL is set, logs are also shipped to Grafana Loki.
 */

const isDev = process.env.NODE_ENV !== "production";
const lokiUrl = process.env.LOKI_URL; // e.g. "http://localhost:3100/loki/api/v1/push"

// Build transport configuration
function buildTransport() {
  // Development: pretty-print to console
  if (isDev && !lokiUrl) {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    };
  }

  // Production with Loki: multi-transport (console JSON + Loki)
  if (lokiUrl) {
    return {
      targets: [
        // Always write JSON to stdout (for Docker/K8s log collectors)
        {
          target: "pino/file",
          options: { destination: 1 }, // stdout
          level: process.env.LOG_LEVEL ?? "info",
        },
        // Ship to Loki
        {
          target: "pino-loki",
          options: {
            baseUrl: lokiUrl,
            labels: {
              service: "cms-monsa",
              environment: process.env.NODE_ENV ?? "development",
            },
            // Batch settings for efficiency
            batchInterval: 5000, // ms
            batchSize: 100,
            clearByAge: true,
            clearAge: 60000, // 1 min
          },
          level: process.env.LOG_LEVEL ?? "info",
        },
      ],
    };
  }

  // Production without Loki: JSON to stdout
  return undefined;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: buildTransport(),
  // Redact sensitive fields in production
  redact: isDev
    ? undefined
    : ["password", "token", "AUTH_SECRET", "cookie", "session"],
  base: {
    service: "cms-monsa",
  },
});

/**
 * Create a child logger with additional context (e.g., request ID).
 *
 * Usage:
 *   const reqLogger = logger.child({ requestId: "abc-123" });
 *   reqLogger.info("Processing request");
 */
export function createRequestLogger(requestId?: string) {
  return logger.child({ requestId: requestId ?? "unknown" });
}
