import { and, eq } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { clinics, memberships, patients, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { seedSharedDemo } from "@/lib/services/demo-seed";
import { createTestDatabase } from "./db";

export const REFERENCE_DATE = new Date().toISOString().slice(0, 10);

/** Fresh in-memory database with both shared demo clinics seeded relative to today. */
export async function createSeededDatabase(): Promise<DatabaseHandle> {
  const db = await createTestDatabase();
  await withSystem((tx) => seedSharedDemo(tx, REFERENCE_DATE), db);
  return db;
}

/** Tenant context for a seeded staff member in a shared demo clinic (by synthetic staff key). */
export async function contextFor(db: DatabaseHandle, staffKey: string): Promise<AppContext> {
  return withSystem(async (tx) => {
    const [row] = await tx
      .select({ userId: memberships.userId, clinicId: memberships.clinicId, role: memberships.role, canManage: memberships.canManage })
      .from(memberships)
      .innerJoin(clinics, eq(clinics.id, memberships.clinicId))
      .where(and(eq(memberships.seedKey, staffKey), eq(clinics.isSandbox, false)));
    if (!row) throw new Error(`No seeded member ${staffKey}`);
    return { userId: row.userId, actorUserId: row.userId, clinicId: row.clinicId, role: row.role, canManage: row.canManage };
  }, db);
}

export async function patientId(db: DatabaseHandle, seedKey: string): Promise<string> {
  return withSystem(async (tx) => {
    const [row] = await tx.select({ id: patients.id }).from(patients)
      .innerJoin(clinics, eq(clinics.id, patients.clinicId))
      .where(and(eq(patients.seedKey, seedKey), eq(clinics.isSandbox, false)));
    if (!row) throw new Error(`No seeded patient ${seedKey}`);
    return row.id;
  }, db);
}

export async function userIdByEmail(db: DatabaseHandle, email: string): Promise<string | undefined> {
  return withSystem(async (tx) => (await tx.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]?.id, db);
}
