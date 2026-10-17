/**
 * Sandbox workspaces: "Try Demo" provisioning, "view as" a fictional
 * colleague, and demo reset. System path (on the ARCHITECTURE §14.2 allowlist)
 * because these create clinics, identities, and sessions.
 */
import { and, eq, sql } from "drizzle-orm";
import { recordAuthEvent } from "@/lib/auth/audit";
import { createSessionRecord, type SessionContext } from "@/lib/auth/session-store";
import { clinics, memberships, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import type { MemberRole } from "@/lib/labels";
import { purgeExpiredSandboxes } from "./demo-cleanup";
import { resetClinicDemoData, seedSyntheticClinic } from "./demo-seed";

/** Which fictional Harbor View colleague a "Try Demo" visitor becomes. */
export const TRY_DEMO_PERSONA: Record<MemberRole, string> = {
  physician: "hv-dr-rivera",
  staff: "hv-fd-okafor",
  clinic_admin: "hv-admin-shah",
};

const today = () => new Date().toISOString().slice(0, 10);

export async function provisionTryDemo(
  role: MemberRole,
  meta: { ipHash?: string | null; userAgent?: string | null } = {},
  database?: DatabaseHandle,
): Promise<{ token: string; expiresAt: Date; clinicId: string; userId: string }> {
  return withSystem(async (tx) => {
    await purgeExpiredSandboxes(tx);
    const seeded = await seedSyntheticClinic(tx, {
      clinicKey: "harbor-view",
      referenceDate: today(),
      sandbox: true,
      clinicName: "Harbor View Family Medicine — DEMO",
    });
    const userId = seeded.staffUserIds[TRY_DEMO_PERSONA[role]];
    const { token, expiresAt } = await createSessionRecord(tx, { userId, clinicId: seeded.clinicId, userAgent: meta.userAgent });
    await recordAuthEvent(tx, {
      action: "demo.sandbox_created",
      clinicId: seeded.clinicId,
      actorUserId: userId,
      entityType: "clinic",
      entityId: seeded.clinicId,
      metadata: { role },
      ipHash: meta.ipHash,
    });
    return { token, expiresAt, clinicId: seeded.clinicId, userId };
  }, database);
}

export interface ViewAsCandidate {
  userId: string;
  displayName: string;
  role: MemberRole;
}

/**
 * View-as is allowed only inside a sandbox, only onto fictional placeholder
 * colleagues, and only for the sandbox's admin or a Try-Demo visitor (who is
 * themselves a placeholder in that sandbox).
 */
async function viewAsAllowed(session: SessionContext, database?: DatabaseHandle): Promise<boolean> {
  if (!session.isSandbox) return false;
  const humanId = session.originalUserId ?? session.userId;
  return withSystem(async (tx) => {
    const [row] = await tx
      .select({ role: memberships.role, status: memberships.status, isPlaceholder: users.isPlaceholder })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.clinicId, session.clinicId), eq(memberships.userId, humanId)));
    return Boolean(row && row.status === "active" && (row.isPlaceholder || row.role === "clinic_admin"));
  }, database);
}

export async function listViewAsCandidates(session: SessionContext, database?: DatabaseHandle): Promise<ViewAsCandidate[]> {
  if (!(await viewAsAllowed(session, database))) return [];
  return withSystem(async (tx) => {
    const rows = await tx
      .select({ userId: users.id, displayName: users.displayName, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.clinicId, session.clinicId), eq(memberships.status, "active"), eq(users.isPlaceholder, true)));
    return rows.filter((row) => row.userId !== session.userId);
  }, database);
}

export async function startViewAs(
  session: SessionContext,
  targetUserId: string,
  meta: { userAgent?: string | null } = {},
  database?: DatabaseHandle,
): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: string }> {
  const candidates = await listViewAsCandidates(session, database);
  const target = candidates.find((candidate) => candidate.userId === targetUserId);
  if (!target) return { ok: false, error: "You can only switch to fictional colleagues inside a demo sandbox." };
  const human = session.originalUserId ?? session.userId;
  return withSystem(async (tx) => {
    // A Try-Demo visitor is already a placeholder; only real admins keep an original user to return to.
    const [humanRow] = await tx.select({ isPlaceholder: users.isPlaceholder }).from(users).where(eq(users.id, human));
    const originalUserId = humanRow?.isPlaceholder ? null : human;
    const grant = await createSessionRecord(tx, { userId: target.userId, clinicId: session.clinicId, originalUserId, userAgent: meta.userAgent });
    await recordAuthEvent(tx, {
      action: "demo.view_as",
      clinicId: session.clinicId,
      actorUserId: human,
      effectiveUserId: target.userId,
      entityType: "user",
      entityId: target.userId,
      metadata: { role: target.role },
    });
    return { ok: true as const, ...grant };
  }, database);
}

export async function returnToOwnAccount(
  session: SessionContext,
  meta: { userAgent?: string | null } = {},
  database?: DatabaseHandle,
): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: string }> {
  if (!session.originalUserId) return { ok: false, error: "You're already using your own account." };
  const original = session.originalUserId;
  return withSystem(async (tx) => {
    const [membership] = await tx.select({ status: memberships.status }).from(memberships)
      .where(and(eq(memberships.clinicId, session.clinicId), eq(memberships.userId, original)));
    if (membership?.status !== "active") return { ok: false as const, error: "Your own account no longer has access to this clinic." };
    const grant = await createSessionRecord(tx, { userId: original, clinicId: session.clinicId, userAgent: meta.userAgent });
    await recordAuthEvent(tx, { action: "demo.view_as_ended", clinicId: session.clinicId, actorUserId: original, effectiveUserId: original });
    return { ok: true as const, ...grant };
  }, database);
}

/** Restores a clinic's synthetic patients, tasks, and flags. Audit history and staff are kept. */
export async function resetDemoClinic(
  input: { clinicId: string; actorUserId: string; effectiveUserId: string },
  database?: DatabaseHandle,
): Promise<void> {
  await withSystem(async (tx) => {
    const [clinic] = await tx.select({ seedKey: clinics.seedKey }).from(clinics).where(eq(clinics.id, input.clinicId));
    if (clinic?.seedKey !== "harbor-view" && clinic?.seedKey !== "orange-grove") {
      throw new Error("Only synthetic demo clinics can be reset.");
    }
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.clinicId}))`);
    await resetClinicDemoData(tx, input.clinicId, clinic.seedKey, today());
    await recordAuthEvent(tx, {
      action: "demo.reset",
      clinicId: input.clinicId,
      actorUserId: input.actorUserId,
      effectiveUserId: input.effectiveUserId,
      entityType: "clinic",
      entityId: input.clinicId,
    });
  }, database);
}
