/**
 * Local account flows. Cookie handling lives in Server Actions; these
 * functions only touch the database so they can be integration-tested.
 */
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { clinics, invitations, joinRequests, memberships, outboxMessages, passwordResetTokens, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { getEnv } from "@/lib/env";
import type { MemberRole } from "@/lib/labels";
import { seedSyntheticClinic } from "@/lib/services/demo-seed";
import { recordAuthEvent } from "./audit";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { createSessionRecord, revokeAllSessionsForUser, type SessionContext } from "./session-store";
import { generateToken, hashToken } from "./tokens";

export const REGISTERED_SANDBOX_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;

export type AuthFailure = { ok: false; error: string; field?: string };
export type SessionGrant = { ok: true; token: string; expiresAt: Date; userId: string; clinicId: string };
/** Signed in while a join request awaits approval: identity-only session, waiting screen only. */
export type PendingGrant = { ok: true; pending: true; token: string; expiresAt: Date; userId: string };

export interface RequestMeta {
  ipHash?: string | null;
  userAgent?: string | null;
}

// Verified against when the email is unknown, so response time doesn't reveal account existence.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password-for-timing"));

const today = () => new Date().toISOString().slice(0, 10);

async function activeMembershipFor(tx: DbTransaction, userId: string) {
  const [membership] = await tx
    .select({ clinicId: memberships.clinicId, role: memberships.role })
    .from(memberships)
    .innerJoin(clinics, eq(clinics.id, memberships.clinicId))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
      sql`(${clinics.expiresAt} IS NULL OR ${clinics.expiresAt} > now())`,
    ))
    .orderBy(desc(memberships.createdAt))
    .limit(1);
  return membership;
}

/** Timing-safe credential check (unknown emails cost the same as wrong passwords). */
export async function findUserByCredentials(tx: DbTransaction, email: string, password: string): Promise<typeof users.$inferSelect | null> {
  const [user] = await tx.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await getDummyHash()), false);
  return user && valid ? user : null;
}

export async function signInWithPassword(
  input: { email: string; password: string },
  meta: RequestMeta = {},
  database?: DatabaseHandle,
): Promise<SessionGrant | PendingGrant | AuthFailure> {
  return withSystem<SessionGrant | PendingGrant | AuthFailure>(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
    const valid = user?.passwordHash
      ? await verifyPassword(input.password, user.passwordHash)
      : (await verifyPassword(input.password, await getDummyHash()), false);
    if (!user || !valid) {
      await recordAuthEvent(tx, {
        action: "auth.sign_in_failed",
        actorUserId: user?.id ?? null,
        metadata: { reason: "invalid_credentials" },
        ipHash: meta.ipHash,
      });
      return { ok: false, error: "That email and password don't match an account." };
    }
    const membership = await activeMembershipFor(tx, user.id);
    if (!membership) {
      // Waiting on a join approval: give an identity-only session for the waiting screen (no clinic data).
      const [pending] = await tx.select({ id: joinRequests.id }).from(joinRequests)
        .where(and(eq(joinRequests.userId, user.id), eq(joinRequests.status, "pending"))).limit(1);
      if (pending) {
        const { token, expiresAt } = await createSessionRecord(tx, { userId: user.id, clinicId: null, userAgent: meta.userAgent });
        await recordAuthEvent(tx, { action: "auth.sign_in", actorUserId: user.id, metadata: { pendingJoin: true }, ipHash: meta.ipHash });
        return { ok: true, pending: true, token, expiresAt, userId: user.id };
      }
      await recordAuthEvent(tx, { action: "auth.sign_in_failed", actorUserId: user.id, metadata: { reason: "no_active_clinic" }, ipHash: meta.ipHash });
      return { ok: false, error: "Your account isn't active in any clinic workspace. Ask your clinic administrator, or your demo workspace may have expired." };
    }
    const { token, expiresAt } = await createSessionRecord(tx, { userId: user.id, clinicId: membership.clinicId, userAgent: meta.userAgent });
    await recordAuthEvent(tx, { action: "auth.sign_in", clinicId: membership.clinicId, actorUserId: user.id, ipHash: meta.ipHash });
    return { ok: true, token, expiresAt, userId: user.id, clinicId: membership.clinicId };
  }, database);
}

/**
 * Creates an account. Without an invitation the user gets a private sandbox
 * clinic seeded with the fictional dataset and becomes its administrator.
 */
export async function registerAccount(
  input: { displayName: string; email: string; password: string; clinicName?: string; inviteToken?: string },
  meta: RequestMeta = {},
  database?: DatabaseHandle,
): Promise<SessionGrant | AuthFailure> {
  const policy = validatePassword(input.password, input.email);
  if (!policy.valid) return { ok: false, field: "password", error: policy.errors.join(" ") };
  const passwordHash = await hashPassword(input.password);

  return withSystem<SessionGrant | AuthFailure>(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing) return { ok: false, field: "email", error: "An account with this email already exists. Try signing in." };

    let invitation: { id: string; clinicId: string; role: MemberRole } | undefined;
    if (input.inviteToken) {
      const found = await findUsableInvitation(tx, input.inviteToken);
      if (!found) return { ok: false, error: "This invitation link is invalid, expired, or already used." };
      if (found.email.toLowerCase() !== input.email.toLowerCase()) {
        return { ok: false, field: "email", error: "Use the email address this invitation was sent to." };
      }
      invitation = found;
    }

    const [user] = await tx.insert(users).values({ email: input.email, displayName: input.displayName, passwordHash }).returning({ id: users.id });
    let clinicId: string;
    if (invitation) {
      // Throwing (not returning) rolls back the user row inserted above.
      if (!(await consumeInvitation(tx, invitation.id))) throw new AbortTransaction({ ok: false, error: "This invitation was just used or revoked." });
      await tx.insert(memberships).values({ clinicId: invitation.clinicId, userId: user.id, role: invitation.role, canManage: false });
      clinicId = invitation.clinicId;
      await recordAuthEvent(tx, { action: "invite.accepted", clinicId, actorUserId: user.id, entityType: "invitation", entityId: invitation.id, metadata: { role: invitation.role } });
    } else {
      const name = (input.clinicName?.trim() || `${input.displayName.split(" ")[0]}'s Clinic`).replace(/\s*[—-]\s*DEMO$/i, "");
      const seeded = await seedSyntheticClinic(tx, {
        clinicKey: "harbor-view",
        referenceDate: today(),
        sandbox: true,
        ownerUserId: user.id,
        clinicName: `${name} — DEMO`,
      });
      clinicId = seeded.clinicId;
      await tx.update(clinics)
        .set({ expiresAt: sql`now() + make_interval(days => ${REGISTERED_SANDBOX_DAYS})` })
        .where(eq(clinics.id, clinicId));
    }
    await recordAuthEvent(tx, { action: "auth.sign_up", clinicId, actorUserId: user.id, ipHash: meta.ipHash, metadata: { via: invitation ? "invitation" : "self_service" } });
    const { token, expiresAt } = await createSessionRecord(tx, { userId: user.id, clinicId, userAgent: meta.userAgent });
    return { ok: true, token, expiresAt, userId: user.id, clinicId } as const;
  }, database).catch(unwrapAbort);
}

async function findUsableInvitation(tx: DbTransaction, token: string) {
  const [row] = await tx
    .select({ id: invitations.id, clinicId: invitations.clinicId, role: invitations.role, email: invitations.email })
    .from(invitations)
    .where(and(
      eq(invitations.tokenHash, hashToken(token, "invite")),
      isNull(invitations.acceptedAt),
      isNull(invitations.revokedAt),
      gt(invitations.expiresAt, sql`now()`),
    ))
    .limit(1);
  return row;
}

/** Atomic single use: only one concurrent caller can flip accepted_at. */
async function consumeInvitation(tx: DbTransaction, invitationId: string): Promise<boolean> {
  const updated = await tx.update(invitations)
    .set({ acceptedAt: sql`now()` })
    .where(and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    .returning({ id: invitations.id });
  return updated.length === 1;
}

export interface InvitationPreview {
  clinicName: string;
  role: MemberRole;
  email: string;
  inviterName: string;
}

export async function getInvitationPreview(token: string, database?: DatabaseHandle): Promise<InvitationPreview | null> {
  return withSystem(async (tx) => {
    const found = await findUsableInvitation(tx, token);
    if (!found) return null;
    const [row] = await tx
      .select({ clinicName: clinics.name, inviterName: users.displayName })
      .from(invitations)
      .innerJoin(clinics, eq(clinics.id, invitations.clinicId))
      .innerJoin(users, eq(users.id, invitations.invitedBy))
      .where(eq(invitations.id, found.id));
    return { clinicName: row.clinicName, inviterName: row.inviterName, role: found.role, email: found.email };
  }, database);
}

/** Signed-in user accepts an invitation addressed to their email; switches the session into that clinic. */
export async function acceptInvitationAsUser(
  token: string,
  user: { id: string; email: string },
  meta: RequestMeta = {},
  database?: DatabaseHandle,
): Promise<SessionGrant | AuthFailure> {
  return withSystem<SessionGrant | AuthFailure>(async (tx) => {
    const invitation = await findUsableInvitation(tx, token);
    if (!invitation) return { ok: false, error: "This invitation link is invalid, expired, or already used." };
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return { ok: false, error: `This invitation was sent to ${invitation.email}. Sign in with that account to accept it.` };
    }
    if (!(await consumeInvitation(tx, invitation.id))) return { ok: false, error: "This invitation was just used or revoked." };
    // Never change an existing membership's role or status through an invitation.
    const [joined] = await tx.insert(memberships)
      .values({ clinicId: invitation.clinicId, userId: user.id, role: invitation.role, canManage: false })
      .onConflictDoNothing({ target: [memberships.clinicId, memberships.userId] })
      .returning({ id: memberships.id });
    if (!joined) throw new AbortTransaction({ ok: false, error: "You already belong to this clinic. Ask its administrator to change your access instead." });
    await recordAuthEvent(tx, { action: "invite.accepted", clinicId: invitation.clinicId, actorUserId: user.id, entityType: "invitation", entityId: invitation.id, metadata: { role: invitation.role } });
    const { token: sessionToken, expiresAt } = await createSessionRecord(tx, { userId: user.id, clinicId: invitation.clinicId, userAgent: meta.userAgent });
    return { ok: true, token: sessionToken, expiresAt, userId: user.id, clinicId: invitation.clinicId };
  }, database).catch(unwrapAbort);
}

/** Simulated email delivery for staff (never patients). */
export async function writeOutbox(
  tx: DbTransaction,
  message: { to: string; subject: string; body: string; kind: "invitation" | "password_reset" | "email_verification" },
): Promise<void> {
  await tx.insert(outboxMessages).values({ toEmail: message.to, subject: message.subject, body: message.body, kind: message.kind });
}

export function selfServiceResetAvailable(): boolean {
  const env = getEnv();
  return env.NODE_ENV !== "production";
}

function resetLink(token: string): string {
  return `${getEnv().APP_BASE_URL}/reset-password/${token}`;
}

async function issueResetToken(tx: DbTransaction, userId: string): Promise<string> {
  const token = generateToken();
  await tx.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token, "reset"),
    expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000).toISOString(),
  });
  return token;
}

/** Always resolves the same way whether or not the account exists. */
export async function requestPasswordReset(email: string, meta: RequestMeta = {}, database?: DatabaseHandle): Promise<void> {
  if (!selfServiceResetAvailable()) return;
  await withSystem(async (tx) => {
    const [user] = await tx.select({ id: users.id, isPlaceholder: users.isPlaceholder }).from(users).where(eq(users.email, email)).limit(1);
    if (!user || user.isPlaceholder) return;
    const token = await issueResetToken(tx, user.id);
    await writeOutbox(tx, {
      to: email,
      kind: "password_reset",
      subject: "Reset your SymptomWatch demo password",
      body: `Use this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password:\n\n${resetLink(token)}\n\nIf you didn't ask for this, you can ignore this message.`,
    });
    await recordAuthEvent(tx, { action: "auth.password_reset_requested", actorUserId: user.id, ipHash: meta.ipHash });
  }, database);
}

/** Admin-issued reset link for a member of the admin's clinic (works without email delivery). */
export async function issueResetLinkForMember(
  input: { adminUserId: string; clinicId: string; memberUserId: string },
  database?: DatabaseHandle,
): Promise<{ ok: true; link: string } | AuthFailure> {
  return withSystem(async (tx) => {
    const [admin] = await tx.select({ canManage: memberships.canManage, status: memberships.status, isSandbox: clinics.isSandbox }).from(memberships)
      .innerJoin(clinics, eq(clinics.id, memberships.clinicId))
      .where(and(eq(memberships.clinicId, input.clinicId), eq(memberships.userId, input.adminUserId)));
    if (!admin?.canManage || admin.status !== "active") return { ok: false, error: "Only clinic managers can issue reset links." };
    // A manager who can mint someone's password can become them. Real clinics use
    // self-service recovery only; manager-issued links exist for demo workspaces.
    if (!admin.isSandbox) return { ok: false, error: "Reset links are only available in demo workspaces. Ask the person to use Forgot password." };
    const [member] = await tx.select({ isPlaceholder: users.isPlaceholder, status: memberships.status }).from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.clinicId, input.clinicId), eq(memberships.userId, input.memberUserId)));
    if (!member) return { ok: false, error: "That person isn't a member of this clinic." };
    if (member.isPlaceholder) return { ok: false, error: "Fictional placeholder colleagues can't sign in." };
    if (member.status !== "active") return { ok: false, error: "Re-enable this person's access before issuing a reset link." };
    // A password belongs to the whole account, not this clinic: never hand one clinic's
    // admin the keys to someone's access elsewhere.
    const [elsewhere] = await tx.select({ id: memberships.id }).from(memberships)
      .where(and(eq(memberships.userId, input.memberUserId), ne(memberships.clinicId, input.clinicId))).limit(1);
    if (elsewhere) return { ok: false, error: "This person also belongs to another clinic, so only they can reset their password (Forgot password on the sign-in page)." };
    const token = await issueResetToken(tx, input.memberUserId);
    await recordAuthEvent(tx, { action: "auth.password_reset_link_issued", clinicId: input.clinicId, actorUserId: input.adminUserId, entityType: "user", entityId: input.memberUserId });
    return { ok: true, link: resetLink(token) };
  }, database);
}

export async function resetPassword(
  input: { token: string; password: string },
  meta: RequestMeta = {},
  database?: DatabaseHandle,
): Promise<{ ok: true } | AuthFailure> {
  return withSystem<{ ok: true } | AuthFailure>(async (tx) => {
    const [consumed] = await tx.update(passwordResetTokens)
      .set({ usedAt: sql`now()` })
      .where(and(
        eq(passwordResetTokens.tokenHash, hashToken(input.token, "reset")),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, sql`now()`),
      ))
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed) return { ok: false, error: "This reset link is invalid, expired, or already used." };
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, consumed.userId));
    const policy = validatePassword(input.password, user.email);
    if (!policy.valid) throw new AbortTransaction({ ok: false, field: "password", error: policy.errors.join(" ") });
    await tx.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, consumed.userId));
    // Any other outstanding link for this account stops working too.
    await tx.update(passwordResetTokens).set({ usedAt: sql`now()` })
      .where(and(eq(passwordResetTokens.userId, consumed.userId), isNull(passwordResetTokens.usedAt)));
    await revokeAllSessionsForUser(tx, consumed.userId);
    await recordAuthEvent(tx, { action: "auth.password_reset_completed", actorUserId: consumed.userId, ipHash: meta.ipHash });
    return { ok: true } as const;
  }, database).catch(unwrapAbort); // An abort rolls back the token consumption so the user can retry.
}

/** Thrown inside a transaction to roll it back while still returning a typed failure. */
class AbortTransaction extends Error {
  constructor(readonly result: AuthFailure) {
    super(result.error);
  }
}

function unwrapAbort(error: unknown): AuthFailure {
  if (error instanceof AbortTransaction) return error.result;
  throw error;
}

export async function recordSignOut(session: SessionContext, database?: DatabaseHandle): Promise<void> {
  await withSystem((tx) => recordAuthEvent(tx, {
    action: "auth.sign_out",
    clinicId: session.clinicId,
    actorUserId: session.originalUserId ?? session.userId,
    effectiveUserId: session.userId,
  }), database);
}

export interface OutboxEntry {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  kind: string;
  createdAt: string;
}

/** Developer outbox (non-production only): simulated staff emails such as invitations and resets. */
export async function listOutbox(database?: DatabaseHandle): Promise<OutboxEntry[]> {
  return withSystem((tx) => tx.select().from(outboxMessages).orderBy(desc(outboxMessages.createdAt)).limit(50), database);
}

/** Simulated invitation email (dev outbox). Real deployments would hand this to a BAA-covered email provider. */
export async function deliverInvitationEmail(
  input: { to: string; clinicName: string; inviterName: string; role: MemberRole; link: string },
  database?: DatabaseHandle,
): Promise<void> {
  await withSystem((tx) => writeOutbox(tx, {
    to: input.to,
    kind: "invitation",
    subject: `${input.inviterName} invited you to ${input.clinicName} on SymptomWatch`,
    body: `You've been invited to join ${input.clinicName} as ${input.role.replace("_", " ")}.\n\nAccept within 7 days:\n${input.link}\n\nThis is a demonstration workspace with fictional data only.`,
  }), database);
}

export function invitationLink(token: string): string {
  return `${getEnv().APP_BASE_URL}/invite/${token}`;
}
