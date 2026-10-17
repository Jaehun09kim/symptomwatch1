/**
 * Database side of sessions. Uses the system path because a session must be
 * resolved before any tenant context exists.
 */
import { and, eq, or, sql } from "drizzle-orm";
import { clinics, memberships, sessions, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import type { MemberRole } from "@/lib/labels";
import { generateToken, hashToken } from "./tokens";

export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionContext {
  sessionId: string;
  userId: string;
  /** Set while a sandbox admin is viewing as a placeholder colleague. */
  originalUserId: string | null;
  email: string;
  displayName: string;
  isPlaceholder: boolean;
  clinicId: string;
  clinicName: string;
  isSandbox: boolean;
  clinicExpiresAt: string | null;
  role: MemberRole;
}

export async function createSessionRecord(
  tx: DbTransaction,
  input: { userId: string; clinicId: string; originalUserId?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);
  await tx.insert(sessions).values({
    userId: input.userId,
    originalUserId: input.originalUserId ?? null,
    tokenHash: hashToken(token, "session"),
    activeClinicId: input.clinicId,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
    expiresAt: expiresAt.toISOString(),
  });
  return { token, expiresAt };
}

/** Resolves a bearer token to a live session, enforcing expiry, membership, and sandbox lifetime. */
export async function resolveSession(token: string, database?: DatabaseHandle): Promise<SessionContext | null> {
  return withSystem(async (tx) => {
    const [row] = await tx
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        originalUserId: sessions.originalUserId,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        email: users.email,
        displayName: users.displayName,
        isPlaceholder: users.isPlaceholder,
        clinicId: clinics.id,
        clinicName: clinics.name,
        isSandbox: clinics.isSandbox,
        clinicExpiresAt: clinics.expiresAt,
        role: memberships.role,
        membershipStatus: memberships.status,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(clinics, eq(clinics.id, sessions.activeClinicId))
      .leftJoin(memberships, and(eq(memberships.clinicId, sessions.activeClinicId), eq(memberships.userId, sessions.userId)))
      .where(eq(sessions.tokenHash, hashToken(token, "session")))
      .limit(1);
    if (!row) return null;

    const now = Date.now();
    const expired =
      new Date(row.expiresAt).getTime() <= now ||
      new Date(row.lastSeenAt).getTime() + SESSION_IDLE_MS <= now ||
      (row.clinicExpiresAt !== null && new Date(row.clinicExpiresAt).getTime() <= now) ||
      row.membershipStatus !== "active" ||
      row.role === null;
    if (expired) {
      await tx.delete(sessions).where(eq(sessions.id, row.sessionId));
      return null;
    }
    if (new Date(row.lastSeenAt).getTime() + TOUCH_INTERVAL_MS < now) {
      await tx.update(sessions).set({ lastSeenAt: sql`now()` }).where(eq(sessions.id, row.sessionId));
    }
    return {
      sessionId: row.sessionId,
      userId: row.userId,
      originalUserId: row.originalUserId,
      email: row.email,
      displayName: row.displayName,
      isPlaceholder: row.isPlaceholder,
      clinicId: row.clinicId,
      clinicName: row.clinicName,
      isSandbox: row.isSandbox,
      clinicExpiresAt: row.clinicExpiresAt,
      role: row.role!,
    };
  }, database);
}

export async function deleteSessionByToken(token: string, database?: DatabaseHandle): Promise<void> {
  await withSystem(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.tokenHash, hashToken(token, "session")));
  }, database);
}

/** Includes "view as" sessions the user started on behalf of placeholder colleagues. */
export async function revokeAllSessionsForUser(tx: DbTransaction, userId: string): Promise<void> {
  await tx.delete(sessions).where(or(eq(sessions.userId, userId), eq(sessions.originalUserId, userId)));
}
