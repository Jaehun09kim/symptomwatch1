import { auditLogs } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/types";

/** Auth events may precede any tenant context (e.g. failed sign-in), so they use the system path. */
export async function recordAuthEvent(
  tx: DbTransaction,
  event: {
    action: string;
    clinicId?: string | null;
    actorUserId?: string | null;
    effectiveUserId?: string | null;
    entityType?: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    action: event.action,
    clinicId: event.clinicId ?? null,
    actorUserId: event.actorUserId ?? null,
    effectiveUserId: event.effectiveUserId ?? event.actorUserId ?? null,
    entityType: event.entityType ?? "user",
    entityId: event.entityId ?? event.actorUserId ?? null,
    metadata: event.metadata ?? {},
    ipHash: event.ipHash ?? null,
  });
}
