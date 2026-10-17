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
import { ServiceError } from "./errors";

const INVITE_DAYS = 7;

function requireAdmin(ctx: AppContext): void {
  if (!can(ctx.role, "staff.manage")) throw new ServiceError("Only clinic administrators can manage staff.");
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

/** Locks the clinic's admin rows so two concurrent demotions can't remove the last administrator. */
async function assertKeepsAnAdmin(tx: DbTransaction, ctx: AppContext, changingUserId: string): Promise<void> {
  const admins = await tx.select({ userId: memberships.userId }).from(memberships)
    .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.role, "clinic_admin"), eq(memberships.status, "active")))
    .for("update");
  if (admins.length === 1 && admins[0].userId === changingUserId) {
    throw new ServiceError("A clinic needs at least one active administrator.");
  }
}

export async function changeMemberRole(
  ctx: AppContext,
  input: { userId: string; role: MemberRole },
  database?: DatabaseHandle,
): Promise<void> {
  requireAdmin(ctx);
  await withTenant(ctx, async (tx) => {
    const [member] = await tx.select({ role: memberships.role }).from(memberships)
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    if (!member) throw new ServiceError("Member not found.");
    if (member.role === input.role) return;
    if (member.role === "clinic_admin") await assertKeepsAnAdmin(tx, ctx, input.userId);
    await tx.update(memberships).set({ role: input.role })
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    await recordAudit(tx, ctx, "membership.role_changed", { type: "user", id: input.userId }, { from: member.role, to: input.role });
  }, database);
}

export async function setMemberStatus(
  ctx: AppContext,
  input: { userId: string; status: "active" | "disabled" },
  database?: DatabaseHandle,
): Promise<void> {
  requireAdmin(ctx);
  if (input.userId === ctx.userId && input.status === "disabled") throw new ServiceError("You can't disable your own access.");
  await withTenant(ctx, async (tx) => {
    const [member] = await tx.select({ role: memberships.role, status: memberships.status }).from(memberships)
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    if (!member) throw new ServiceError("Member not found.");
    if (member.status === input.status) return;
    if (input.status === "disabled" && member.role === "clinic_admin") await assertKeepsAnAdmin(tx, ctx, input.userId);
    await tx.update(memberships).set({ status: input.status })
      .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, input.userId)));
    await recordAudit(tx, ctx, input.status === "disabled" ? "membership.disabled" : "membership.enabled", { type: "user", id: input.userId });
  }, database);
}
