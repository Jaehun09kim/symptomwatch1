import { and, eq, lt } from "drizzle-orm";
import { clinics } from "../db/schema";
import type { DbTransaction } from "../db/types";

/** Clinical data cascades; audit history survives with clinic_id set to NULL. */
export async function purgeExpiredSandboxes(tx: DbTransaction, asOf = new Date()): Promise<number> {
  const removed = await tx.delete(clinics).where(and(
    eq(clinics.isSandbox, true), lt(clinics.expiresAt, asOf.toISOString()),
  )).returning({ id: clinics.id });
  return removed.length;
}
