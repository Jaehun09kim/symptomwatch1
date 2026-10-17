import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "./client";
import type { DatabaseHandle, DbTransaction } from "./types";

const tenantContext = z.object({ userId: z.uuid(), clinicId: z.uuid() });
export type TenantContext = z.infer<typeof tenantContext>;

export async function withTenant<T>(
  context: TenantContext,
  fn: (tx: DbTransaction) => Promise<T>,
  database?: DatabaseHandle,
): Promise<T> {
  const { userId, clinicId } = tenantContext.parse(context);
  const handle = database ?? await getDatabase();
  return handle.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE sw_app`);
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true), set_config('app.clinic_id', ${clinicId}, true)`);
    return fn(tx);
  });
}
