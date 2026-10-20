import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { auditLogs, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { ServiceError } from "./errors";

/** Records an audit event inside the caller's tenant transaction. Never put clinical free text in metadata. */
export async function recordAudit(
  tx: DbTransaction,
  ctx: AppContext,
  action: string,
  entity: { type: string; id?: string | null },
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx.insert(auditLogs).values({
    clinicId: ctx.clinicId,
    actorUserId: ctx.actorUserId,
    effectiveUserId: ctx.userId,
    action,
    entityType: entity.type,
    entityId: entity.id ?? null,
    metadata,
  });
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
  effectiveName: string | null;
}

export interface AuditQuery {
  action?: string;
  from?: string;
  to?: string;
  page?: number;
}

export const AUDIT_PAGE_SIZE = 25;

export async function listAuditLog(ctx: AppContext, query: AuditQuery = {}, database?: DatabaseHandle): Promise<{ entries: AuditEntry[]; total: number }> {
  if (!can(ctx, "audit.read")) throw new ServiceError("Only clinic administrators can view the audit log.");
  return withTenant(ctx, async (tx) => {
    const filters = [eq(auditLogs.clinicId, ctx.clinicId)];
    if (query.action) filters.push(sql`${auditLogs.action} LIKE ${`${query.action}%`}`);
    if (query.from) filters.push(gte(auditLogs.createdAt, query.from));
    if (query.to) filters.push(lte(auditLogs.createdAt, query.to));
    const where = and(...filters);
    // Users table is readable (names only) for members of the current clinic — see migration 0004.
    const actor = sql<string | null>`(select display_name from ${users} where ${users.id} = ${auditLogs.actorUserId})`;
    const effective = sql<string | null>`(select display_name from ${users} where ${users.id} = ${auditLogs.effectiveUserId})`;
    const page = Math.max(1, query.page ?? 1);
    const [entries, [{ total }]] = await Promise.all([
      tx.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: actor,
        effectiveName: effective,
      }).from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(AUDIT_PAGE_SIZE).offset((page - 1) * AUDIT_PAGE_SIZE),
      tx.select({ total: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    ]);
    return { entries, total };
  }, database);
}
