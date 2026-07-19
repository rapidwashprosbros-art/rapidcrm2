import { scopedDb } from "@/lib/db-scoped";
import type { RequestContext } from "@/types";

interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(ctx: RequestContext, entry: AuditEntry): Promise<void> {
  const db = scopedDb(ctx);
  await db.auditLog.create({
    data: {
      userId: ctx.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? undefined,
    },
  });
}
