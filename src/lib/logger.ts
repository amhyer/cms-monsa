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
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
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
