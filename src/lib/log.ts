import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { logger } from "@/lib/logger";

/**
 * Record an activity log entry. Fire-and-forget — should never break the
 * main request if logging fails.
 */
export async function logActivity(
  user: SessionUser,
  action: string,
  entity: string,
  detail: string,
  entityId?: string
) {
  try {
    await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action,
        entity,
        entityId: entityId ?? null,
        detail,
      },
    });
  } catch (e) {
    logger.error({ err: e, action, entity, userId: user.id }, "[logActivity] failed");
  }
}
