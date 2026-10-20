import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { deliverInvitationEmail, invitationLink } from "@/lib/auth/accounts";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { clinics, invitations, memberships, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import type { MemberRole } from "@/lib/labels";
import { recordAudit } from "./audit";
import { CLINICAL_ROLES, recordClinicalGrant } from "./clinical-grants";
import { ServiceError } from "./errors";

const INVITE_DAYS = 7;

const NOT_MANAGER = "Only clinic managers can manage staff.";
const SELF_CHANGE = "You can't change your own access. Ask another manager.";
const LAST_MANAGER = "A clinic needs at least one active manager.";

function requireAdmin(ctx: AppContext): void {
  if (!can(ctx, "staff.manage")) throw new ServiceError(NOT_MANAGER);
}

/**
 * Access changes act for a human. While a sandbox manager is "viewing as" a
 * colleague, the effective user isn't the person deciding, so refuse outright
 * (Codex review: self-checks compared against the colleague, not the human).
 */
/** Managers acting as themselves (not while viewing as a colleague). */
export function requireManagerActingAsSelf(ctx: AppContext): void {
  requireAdmin(ctx);
  requireActingAsSelf(ctx);
}

function requireActingAsSelf(ctx: AppContext): void {
  if (ctx.actorUserId !== ctx.userId) throw new ServiceError("Access changes aren't available while viewing as a colleague.");
}

function isSelf(ctx: AppContext, userId: string): boolean {
  return userId === ctx.userId || userId === ctx.actorUserId;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByName: string | null;
}

export async function listInvitations(ctx: AppContext, database?: DatabaseHandle): Promise<InvitationRow[]> {
  requireAdmin(ctx);
  return withTenant(ctx, (tx) => tx
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      invitedByName: users.displayName,
    })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(eq(invitations.clinicId, ctx.clinicId))
    .orderBy(desc(invitations.expiresAt))
    .limit(50), database);
}

/** Returns the invitation link so the admin can share it directly (no real email is sent). */
export async function inviteStaff(
  ctx: AppContext,
  input: { email: string; role: MemberRole },
  database?: DatabaseHandle,
): Promise<{ link: string }> {
  requireAdmin(ctx);
  const token = generateToken();
  const details = await withTenant(ctx, async (tx) => {
    const [existing] = await tx.select({ id: memberships.id }).from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(users.email, input.email)));
    if (existing) throw new ServiceError("That person is already a member of this clinic.");
    // Re-inviting replaces any outstanding invitation for the same address.
    await tx.update(invitations).set({ revokedAt: sql`now()` })
      .where(and(eq(invitations.clinicId, ctx.clinicId), eq(invitations.email, input.email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    const [row] = await tx.insert(invitations).values({
      clinicId: ctx.clinicId,
      email: input.email,
      role: input.role,
      tokenHash: hashToken(token, "invite"),
      invitedBy: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    }).returning({ id: invitations.id });
    await recordAudit(tx, ctx, "invite.created", { type: "invitation", id: row.id }, { role: input.role });
    const [clinic] = await tx.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, ctx.clinicId));
    const [inviter] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, ctx.userId));
    return { clinicName: clinic.name, inviterName: inviter?.name ?? "Your clinic administrator" };
  }, database);
  const link = invitationLink(token);
  await deliverInvitationEmail({ to: input.email, role: input.role, link, ...details }, database);
  return { link };
}

export async function revokeInvitation(ctx: AppContext, invitationId: string, database?: DatabaseHandle): Promise<void> {
  requireAdmin(ctx);
  await withTenant(ctx, async (tx) => {
    const updated = await tx.update(invitations).set({ revokedAt: sql`now()` })
      .where(and(eq(invitations.clinicId, ctx.clinicId), eq(invitations.id, invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
      .returning({ id: invitations.id });
    if (!updated.length) throw new ServiceError("That invitation is no longer pending.");
    await recordAudit(tx, ctx, "invite.revoked", { type: "invitation", id: invitationId });
  }, database);
}

export interface LockedMember { userId: string; role: MemberRole; status: "active" | "disabled"; canManage: boolean; isPlaceholder: boolean }

/**
 * Serializes membership management per clinic: locks every membership row, then
 * re-checks that the actor is still an active manager (a concurrent change may
 * have removed them while they waited for the lock).
 */
export async function lockClinicMemberships(tx: DbTransaction, ctx: AppContext): Promise<LockedMember[]> {
  const rows = await tx.select({
    userId: memberships.userId,
    role: memberships.role,
    status: memberships.status,
    canManage: memberships.canManage,
    isPlaceholder: users.isPlaceholder,
  }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.clinicId, ctx.clinicId))
    .for("update", { of: memberships });
  const actor = rows.find((row) => row.userId === ctx.userId);
  if (!actor || actor.status !== "active" || !actor.canManage) throw new ServiceError(NOT_MANAGER);
  return rows;
}

/** Placeholders (fictional sandbox colleagues) can't sign in, so they don't count as the clinic's manager. */
function assertKeepsAHumanManager(rows: LockedMember[], losingUserId: string): void {
  const remaining = rows.filter((row) => row.status === "active" && row.canManage && !row.isPlaceholder && row.userId !== losingUserId);
  if (!remaining.length) throw new ServiceError(LAST_MANAGER);
}

function findMember(rows: LockedMember[], userId: string): LockedMember {
  const member = rows.find((row) => row.userId === userId);
  if (!member) throw new ServiceError("Member not found.");
  return member;
}


export async function changeMemberRole(
  ctx: AppContext,
  input: { userId: string; role: MemberRole },
  database?: DatabaseHandle,
): Promise<void> {
  requireAdmin(ctx);
  requireActingAsSelf(ctx);
  if (isSelf(ctx, input.userId)) throw new ServiceError(SELF_CHANGE);
  await withTenant(ctx, async (tx) => {
    const member = findMember(await lockClinicMemberships(tx, ctx), input.userId);
    if (member.role === input.role) return;
    await tx.update(memberships).set({ role: input.role })
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    // Granting clinical access is recorded distinctly so physicians can be shown who was let in.
    const clinicalGrant = CLINICAL_ROLES.has(input.role) && !CLINICAL_ROLES.has(member.role);
    await recordAudit(tx, ctx, "membership.role_changed", { type: "user", id: input.userId },
      { from: member.role, to: input.role, ...(clinicalGrant ? { clinicalGrant: true } : {}) });
    if (clinicalGrant) await recordClinicalGrant(tx, { clinicId: ctx.clinicId, userId: input.userId, role: input.role, grantedBy: ctx.userId, via: "role_change" });
  }, database);
}

export async function setMemberCanManage(
  ctx: AppContext,
  input: { userId: string; canManage: boolean },
  database?: DatabaseHandle,
): Promise<void> {
  requireAdmin(ctx);
  requireActingAsSelf(ctx);
  if (isSelf(ctx, input.userId)) throw new ServiceError(SELF_CHANGE);
  await withTenant(ctx, async (tx) => {
    const rows = await lockClinicMemberships(tx, ctx);
    const member = findMember(rows, input.userId);
    if (member.canManage === input.canManage) return;
    if (!input.canManage) assertKeepsAHumanManager(rows, input.userId);
    await tx.update(memberships).set({ canManage: input.canManage })
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    await recordAudit(tx, ctx, "membership.manage_changed", { type: "user", id: input.userId }, { from: member.canManage, to: input.canManage });
  }, database);
}

export async function setMemberStatus(
  ctx: AppContext,
  input: { userId: string; status: "active" | "disabled" },
  database?: DatabaseHandle,
): Promise<void> {
  requireAdmin(ctx);
  requireActingAsSelf(ctx);
  if (isSelf(ctx, input.userId)) throw new ServiceError(input.status === "disabled" ? "You can't disable your own access." : SELF_CHANGE);
  await withTenant(ctx, async (tx) => {
    const rows = await lockClinicMemberships(tx, ctx);
    const member = findMember(rows, input.userId);
    if (member.status === input.status) return;
    if (input.status === "disabled" && member.canManage) assertKeepsAHumanManager(rows, input.userId);
    await tx.update(memberships).set({ status: input.status })
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    await recordAudit(tx, ctx, input.status === "disabled" ? "membership.disabled" : "membership.enabled", { type: "user", id: input.userId });
  }, database);
}
