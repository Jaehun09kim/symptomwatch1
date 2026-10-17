import { count } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { clinics } from "../db/schema";
import { withSystem } from "../db/system";

/** Public runtime spike exposes aggregate infrastructure counts only. */
export async function getDemoHealth() {
  const database = await getDatabase();
  const [row] = await withSystem((tx) => tx.select({ clinics: count() }).from(clinics), database);
  return { status: "ok" as const, driver: database.driver, migrationsApplied: database.migrationsApplied, clinics: row.clinics };
}
