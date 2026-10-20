import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { hashToken } from "@/lib/auth/tokens";
import { clinicalAccessGrants, joinCodes, joinRequests, memberships, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import type { MemberRole } from "@/lib/labels";
import { generateJoinCode } from "@/lib/onboarding/codes";
import { alias } from "drizzle-orm/pg-core";
import { recordAudit } from "./audit";
import { CLINICAL_ROLES, recordClinicalGrant } from "./clinical-grants";
import { ServiceError } from "./errors";
import { lockClinicMemberships, requireManagerActingAsSelf } from "./staff";

export { recordClinicalGrant } from "./clinical-grants";

export type ApprovalMode = "approve" | "instant";

/** Creates a 90-second role code. The code itself is returned once and never stored. */
export async function createJoinCode(
  ctx: AppContext,
  input: { role: MemberRole; approvalMode: ApprovalMode },
  database?: DatabaseHandle,
): Promise<{ id: string; display: string; expiresAt: string }> {
  requireManagerActingAsSelf(ctx);
  return withTenant(ctx, async (tx) => {
    // Hashes are unique across all clinics; on the (astronomically rare) collision, draw again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { code, display } = generateJoinCode();
      const [row] = await tx.insert(joinCodes)
        .values({ clinicId: ctx.clinicId, role: input.role, approvalMode: input.approvalMode, codeHash: hashToken(code, "join_code"), createdBy: ctx.userId })
        .onConflictDoNothing({ target: joinCodes.codeHash })
        .returning({ id: joinCodes.id, expiresAt: joinCodes.expiresAt });
      if (!row) continue;
      await recordAudit(tx, ctx, "join_code.created", { type: "join_code", id: row.id }, { role: input.role, approvalMode: input.approvalMode });
      return { id: row.id, display, expiresAt: new Date(row.expiresAt).toISOString() };
    }
    throw new ServiceError("Couldn't create a code. Please try again.");
  }, database);
}

/** Turns a code off early; anyone still waiting on it is declined. */
export async function cancelJoinCode(ctx: AppContext, codeId: string, database?: DatabaseHandle): Promise<void> {
  requireManagerActingAsSelf(ctx);
  await withTenant(ctx, async (tx) => {
    const revoked = await tx.update(joinCodes).set({ revokedAt: sql`now()` })
      .where(and(eq(joinCodes.clinicId, ctx.clinicId), eq(joinCodes.id, codeId), sql`${joinCodes.revokedAt} IS NULL`))
      .returning({ id: joinCodes.id });
    if (!revoked.length) throw new ServiceError("That code is no longer active.");
    await tx.update(joinRequests).set({ status: "declined", decidedBy: ctx.userId, decidedAt: sql`now()` })
      .where(and(eq(joinRequests.clinicId, ctx.clinicId), eq(joinRequests.joinCodeId, codeId), eq(joinRequests.status, "pending")));
    await recordAudit(tx, ctx, "join_code.revoked", { type: "join_code", id: codeId });
  }, database);
}

export interface JoinRequestRow {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  requestedRole: MemberRole;
  createdAt: string;
}

export async function listJoinRequests(ctx: AppContext, database?: DatabaseHandle): Promise<JoinRequestRow[]> {
  requireManagerActingAsSelf(ctx);
  return withTenant(ctx, async (tx) => {
    const rows = await tx.select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      displayName: users.displayName,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      requestedRole: joinRequests.requestedRole,
      createdAt: joinRequests.createdAt,
    }).from(joinRequests)
      .innerJoin(users, eq(users.id, joinRequests.userId))
      .where(and(eq(joinRequests.clinicId, ctx.clinicId), eq(joinRequests.status, "pending")))
      .orderBy(asc(joinRequests.createdAt));
    return rows.map(({ emailVerifiedAt, ...row }) => ({ ...row, emailVerified: emailVerifiedAt !== null }));
  }, database);
}

/**
 * One decision per request: locks the clinic's memberships (re-checking the
 * manager) and the request row, moves only `pending`, and never overwrites an
 * existing membership. Approved members start without manager access.
 */
export async function decideJoinRequest(
  ctx: AppContext,
  input: { requestId: string; decision: "approve" | "decline"; role?: MemberRole },
  database?: DatabaseHandle,
): Promise<void> {
  requireManagerActingAsSelf(ctx);
  await withTenant(ctx, async (tx) => {
    const members = await lockClinicMemberships(tx, ctx);
    const [request] = await tx.select().from(joinRequests)
      .where(and(eq(joinRequests.clinicId, ctx.clinicId), eq(joinRequests.id, input.requestId)))
      .for("update");
    if (!request) throw new ServiceError("Request not found.");
    if (request.status !== "pending") throw new ServiceError("This request was already decided.");

    if (input.decision === "decline") {
      await tx.update(joinRequests).set({ status: "declined", decidedBy: ctx.userId, decidedAt: sql`now()` })
        .where(and(eq(joinRequests.id, request.id), eq(joinRequests.status, "pending")));
      await recordAudit(tx, ctx, "join_request.declined", { type: "join_request", id: request.id });
      return;
    }

    if (members.some((member) => member.userId === request.userId)) throw new ServiceError("This person already belongs to this clinic.");
    const role = input.role ?? request.requestedRole;
    await tx.insert(memberships).values({ clinicId: ctx.clinicId, userId: request.userId, role, canManage: false });
    await tx.update(joinRequests).set({ status: "approved", decidedBy: ctx.userId, decidedRole: role, decidedAt: sql`now()` })
      .where(and(eq(joinRequests.id, request.id), eq(joinRequests.status, "pending")));
    if (CLINICAL_ROLES.has(role)) await recordClinicalGrant(tx, { clinicId: ctx.clinicId, userId: request.userId, role, grantedBy: ctx.userId, via: "join" });
    await recordAudit(tx, ctx, "join_request.approved", { type: "join_request", id: request.id }, { role });
  }, database);
}

/** Recent clinical-access grants in this clinic (last 14 days), for the physicians' notice. */
export async function listRecentClinicalGrants(ctx: AppContext, database?: DatabaseHandle): Promise<Array<{
  userName: string; role: MemberRole; grantedByName: string | null; via: "role_change" | "join"; createdAt: string;
}>> {
  const granter = alias(users, "granter");
  return withTenant(ctx, (tx) => tx.select({
    userName: users.displayName,
    role: clinicalAccessGrants.role,
    grantedByName: granter.displayName,
    via: clinicalAccessGrants.via,
    createdAt: clinicalAccessGrants.createdAt,
  }).from(clinicalAccessGrants)
    .innerJoin(users, eq(users.id, clinicalAccessGrants.userId))
    .leftJoin(granter, eq(granter.id, clinicalAccessGrants.grantedBy))
    .where(and(eq(clinicalAccessGrants.clinicId, ctx.clinicId), gte(clinicalAccessGrants.createdAt, sql`now() - interval '14 days'`)))
    .orderBy(desc(clinicalAccessGrants.createdAt)), database);
}
