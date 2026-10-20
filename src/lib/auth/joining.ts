/**
 * Joining a clinic with a role code (onboarding M2). Applicants have no
 * membership yet, so this runs on the trusted system path (auth module). The
 * code only opens a 15-minute, single-use join transaction; membership is
 * granted only after the person's email is confirmed, either at once
 * ("instant" codes) or after a manager approves ("approve" codes).
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { clinics, emailVerifications, joinCodes, joinRequests, joinTransactions, memberships, sessions, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { getEnv } from "@/lib/env";
import type { MemberRole } from "@/lib/labels";
import { normalizeJoinCode } from "@/lib/onboarding/codes";
import { RATE_LIMITS, rateLimiter } from "@/lib/security/rate-limit";
import { CLINICAL_ROLES, recordClinicalGrant } from "@/lib/services/clinical-grants";
import { findUserByCredentials, writeOutbox, type RequestMeta, type SessionGrant } from "./accounts";
import { recordAuthEvent } from "./audit";
import { hashPassword, validatePassword } from "./password";
import { createSessionRecord, resolveIdentitySession } from "./session-store";
import { generateToken, hashToken } from "./tokens";

const JOIN_WINDOW_MS = 15 * 60_000;
const VERIFY_WINDOW_MS = 30 * 60_000;
export const INVALID_CODE = "That code isn't valid. Codes expire 90 seconds after they're created — ask for a new one.";
const EXPIRED_JOIN = "This join has expired. Ask your clinic for a new code.";

type Failure = { ok: false; error: string; field?: string };
export type JoinStep =
  | { ok: true; next: "verify_email"; email: string }
  | { ok: true; next: "joined"; session: SessionGrant }
  | { ok: true; next: "waiting"; session: { token: string; expiresAt: Date } }
  | Failure;

class Abort extends Error {
  constructor(readonly result: Failure) { super(result.error); }
}
const unwrap = (error: unknown): Failure => {
  if (error instanceof Abort) return error.result;
  throw error;
};

/** Step 1: a valid, unexpired, unrevoked code opens a join transaction. One generic message otherwise. */
export async function startJoin(
  rawCode: string,
  meta: RequestMeta,
  database?: DatabaseHandle,
  now = new Date(),
): Promise<{ ok: true; token: string; clinicName: string; role: MemberRole; expiresAt: Date } | Failure> {
  if (!rateLimiter().check(`join-code:${meta.ipHash ?? "unknown"}`, RATE_LIMITS.joinCode).allowed) {
    return { ok: false, error: "Too many code attempts. Please wait a few minutes and try again." };
  }
  const code = normalizeJoinCode(rawCode);
  if (!code) return { ok: false, error: INVALID_CODE };
  return withSystem(async (tx) => {
    const [found] = await tx.select({
      id: joinCodes.id, clinicId: joinCodes.clinicId, role: joinCodes.role, approvalMode: joinCodes.approvalMode,
      expiresAt: joinCodes.expiresAt, revokedAt: joinCodes.revokedAt, clinicName: clinics.name,
    }).from(joinCodes).innerJoin(clinics, eq(clinics.id, joinCodes.clinicId))
      .where(eq(joinCodes.codeHash, hashToken(code, "join_code"))).limit(1);
    if (!found || found.revokedAt || new Date(found.expiresAt).getTime() <= now.getTime()) {
      await recordAuthEvent(tx, { action: "join.code_rejected", ipHash: meta.ipHash });
      return { ok: false, error: INVALID_CODE } as const;
    }
    const token = generateToken();
    const expiresAt = new Date(now.getTime() + JOIN_WINDOW_MS);
    await tx.insert(joinTransactions).values({
      tokenHash: hashToken(token, "join"), joinCodeId: found.id, clinicId: found.clinicId,
      role: found.role, approvalMode: found.approvalMode, expiresAt: expiresAt.toISOString(),
    });
    await recordAuthEvent(tx, { action: "join.code_accepted", clinicId: found.clinicId, entityType: "join_code", entityId: found.id, ipHash: meta.ipHash });
    return { ok: true, token, clinicName: found.clinicName, role: found.role, expiresAt } as const;
  }, database);
}

/** What a join transaction is for (clinic and role), if it is still usable. */
export async function peekJoin(token: string, database?: DatabaseHandle, now = new Date()): Promise<{ clinicName: string; role: MemberRole } | null> {
  return withSystem(async (tx) => {
    const txn = await usableTransaction(tx, token, now);
    if (!txn) return null;
    const [clinic] = await tx.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, txn.clinicId));
    return { clinicName: clinic.name, role: txn.role };
  }, database);
}

async function usableTransaction(tx: DbTransaction, token: string, now: Date) {
  const [txn] = await tx.select().from(joinTransactions).where(eq(joinTransactions.tokenHash, hashToken(token, "join"))).limit(1);
  if (!txn || txn.consumedAt || new Date(txn.expiresAt).getTime() <= now.getTime()) return null;
  return txn;
}

/** Step 2: sign in or create an account. Verified emails finish now; others get a confirmation link. */
export async function attachJoinAccount(
  token: string,
  input: { mode: "sign_in"; email: string; password: string } | { mode: "sign_up"; displayName: string; email: string; password: string },
  meta: RequestMeta,
  database?: DatabaseHandle,
  now = new Date(),
): Promise<JoinStep> {
  let passwordHash: string | undefined;
  if (input.mode === "sign_up") {
    const policy = validatePassword(input.password, input.email);
    if (!policy.valid) return { ok: false, field: "password", error: policy.errors.join(" ") };
    passwordHash = await hashPassword(input.password);
  }
  return withSystem<JoinStep>(async (tx) => {
    const txn = await usableTransaction(tx, token, now);
    if (!txn) return { ok: false, error: EXPIRED_JOIN };

    let user: typeof users.$inferSelect;
    if (input.mode === "sign_in") {
      const found = await findUserByCredentials(tx, input.email, input.password);
      if (!found) return { ok: false, error: "That email and password don't match an account." };
      user = found;
    } else {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) return { ok: false, field: "email", error: "An account with this email already exists. Choose “I already have an account”." };
      [user] = await tx.insert(users).values({ email: input.email, displayName: input.displayName, passwordHash }).returning();
    }
    await assertNotAMember(tx, txn.clinicId, user.id);
    await tx.update(joinTransactions).set({ userId: user.id }).where(eq(joinTransactions.id, txn.id));

    if (user.emailVerifiedAt) return completeJoin(tx, txn.id, user.id, meta, now);
    const verification = generateToken();
    await tx.insert(emailVerifications).values({
      userId: user.id, tokenHash: hashToken(verification, "verify"), joinTransactionId: txn.id,
      expiresAt: new Date(now.getTime() + VERIFY_WINDOW_MS).toISOString(),
    });
    await writeOutbox(tx, {
      to: user.email,
      subject: "Confirm your email to join your clinic on SymptomWatch",
      body: `Confirm this address to finish joining (link valid for 30 minutes):\n\n${getEnv().APP_BASE_URL}/verify-email/${verification}\n\nIf you didn't ask to join a clinic, ignore this message.`,
      kind: "email_verification",
    });
    return { ok: true, next: "verify_email", email: user.email };
  }, database).catch(unwrap);
}

/** Step 3: the confirmation link marks the email verified and finishes the join. Single-use. */
export async function verifyEmailAndJoin(verificationToken: string, meta: RequestMeta, database?: DatabaseHandle, now = new Date()): Promise<JoinStep> {
  return withSystem<JoinStep>(async (tx) => {
    const [used] = await tx.update(emailVerifications).set({ usedAt: now.toISOString() })
      .where(and(eq(emailVerifications.tokenHash, hashToken(verificationToken, "verify")), isNull(emailVerifications.usedAt),
        sql`${emailVerifications.expiresAt} > ${now.toISOString()}`))
      .returning();
    if (!used) return { ok: false, error: "This confirmation link is invalid, expired, or already used." };
    await tx.update(users).set({ emailVerifiedAt: now.toISOString() }).where(and(eq(users.id, used.userId), isNull(users.emailVerifiedAt)));
    await recordAuthEvent(tx, { action: "auth.email_verified", actorUserId: used.userId, ipHash: meta.ipHash });
    if (!used.joinTransactionId) return { ok: false, error: EXPIRED_JOIN };
    return completeJoin(tx, used.joinTransactionId, used.userId, meta, now);
  }, database).catch(unwrap);
}

async function assertNotAMember(tx: DbTransaction, clinicId: string, userId: string): Promise<void> {
  const [existing] = await tx.select({ id: memberships.id }).from(memberships)
    .where(and(eq(memberships.clinicId, clinicId), eq(memberships.userId, userId))).limit(1);
  if (existing) throw new Abort({ ok: false, error: "You already belong to this clinic. Sign in instead." });
}

/** Consumes the transaction exactly once, then grants access (instant) or files a request (approve). */
async function completeJoin(tx: DbTransaction, transactionId: string, userId: string, meta: RequestMeta, now: Date): Promise<JoinStep> {
  const [txn] = await tx.update(joinTransactions).set({ consumedAt: now.toISOString() })
    .where(and(eq(joinTransactions.id, transactionId), isNull(joinTransactions.consumedAt), sql`${joinTransactions.expiresAt} > ${now.toISOString()}`))
    .returning();
  if (!txn) throw new Abort({ ok: false, error: EXPIRED_JOIN });
  await assertNotAMember(tx, txn.clinicId, userId);

  if (txn.approvalMode === "instant") {
    // Instant codes never grant management; every join still leaves one request record.
    await tx.insert(memberships).values({ clinicId: txn.clinicId, userId, role: txn.role, canManage: false });
    await tx.insert(joinRequests).values({
      clinicId: txn.clinicId, userId, requestedRole: txn.role, joinCodeId: txn.joinCodeId,
      status: "approved", decidedRole: txn.role, decidedAt: now.toISOString(),
    });
    if (CLINICAL_ROLES.has(txn.role)) await recordClinicalGrant(tx, { clinicId: txn.clinicId, userId, role: txn.role, grantedBy: null, via: "join" });
    await recordAuthEvent(tx, { action: "join.completed", clinicId: txn.clinicId, actorUserId: userId, metadata: { role: txn.role, mode: "instant" }, ipHash: meta.ipHash });
    const { token, expiresAt } = await createSessionRecord(tx, { userId, clinicId: txn.clinicId, userAgent: meta.userAgent });
    return { ok: true, next: "joined", session: { ok: true, token, expiresAt, userId, clinicId: txn.clinicId } };
  }

  const [pending] = await tx.select({ id: joinRequests.id }).from(joinRequests)
    .where(and(eq(joinRequests.clinicId, txn.clinicId), eq(joinRequests.userId, userId), eq(joinRequests.status, "pending"))).limit(1);
  if (!pending) {
    await tx.insert(joinRequests).values({ clinicId: txn.clinicId, userId, requestedRole: txn.role, joinCodeId: txn.joinCodeId });
  }
  await recordAuthEvent(tx, { action: "join.requested", clinicId: txn.clinicId, actorUserId: userId, metadata: { role: txn.role }, ipHash: meta.ipHash });
  const session = await createSessionRecord(tx, { userId, clinicId: null, userAgent: meta.userAgent });
  return { ok: true, next: "waiting", session };
}

export interface PendingJoin {
  requestId: string;
  clinicId: string;
  clinicName: string;
  status: "pending" | "approved" | "declined" | "withdrawn";
}

/** The applicant's own join requests, for the waiting screen. */
export async function getPendingJoins(sessionToken: string, database?: DatabaseHandle): Promise<PendingJoin[]> {
  const identity = await resolveIdentitySession(sessionToken, database);
  if (!identity) return [];
  return withSystem((tx) => tx.select({
    requestId: joinRequests.id, clinicId: joinRequests.clinicId, clinicName: clinics.name, status: joinRequests.status,
  }).from(joinRequests).innerJoin(clinics, eq(clinics.id, joinRequests.clinicId))
    .where(eq(joinRequests.userId, identity.userId))
    .orderBy(asc(joinRequests.createdAt)), database);
}

export async function withdrawJoin(sessionToken: string, requestId: string, database?: DatabaseHandle): Promise<{ ok: boolean }> {
  const identity = await resolveIdentitySession(sessionToken, database);
  if (!identity) return { ok: false };
  return withSystem(async (tx) => {
    const updated = await tx.update(joinRequests).set({ status: "withdrawn", decidedAt: sql`now()` })
      .where(and(eq(joinRequests.id, requestId), eq(joinRequests.userId, identity.userId), eq(joinRequests.status, "pending")))
      .returning({ id: joinRequests.id });
    return { ok: updated.length === 1 };
  }, database);
}

/** After approval: swap the identity-only session for a clinic session. */
export async function enterApprovedClinic(sessionToken: string, clinicId: string, meta: RequestMeta, database?: DatabaseHandle): Promise<SessionGrant | Failure> {
  const identity = await resolveIdentitySession(sessionToken, database);
  if (!identity) return { ok: false, error: "Your session has ended. Please sign in again." };
  return withSystem(async (tx) => {
    const [member] = await tx.select({ status: memberships.status }).from(memberships)
      .where(and(eq(memberships.clinicId, clinicId), eq(memberships.userId, identity.userId))).limit(1);
    if (member?.status !== "active") return { ok: false, error: "You don't have access to this clinic yet." } as const;
    await tx.delete(sessions).where(eq(sessions.id, identity.sessionId));
    const { token, expiresAt } = await createSessionRecord(tx, { userId: identity.userId, clinicId, userAgent: meta.userAgent });
    return { ok: true, token, expiresAt, userId: identity.userId, clinicId } as const;
  }, database);
}
