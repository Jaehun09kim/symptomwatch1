import { clinicalAccessGrants } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/types";
import type { MemberRole } from "@/lib/labels";

/** Roles that can read clinical detail; granting one is shown to the clinic's physicians. */
export const CLINICAL_ROLES: ReadonlySet<MemberRole> = new Set(["physician", "clinic_admin"]);

/** Records that someone was given clinical access (via a role change or by joining with a code). */
export async function recordClinicalGrant(
  tx: DbTransaction,
  input: { clinicId: string; userId: string; role: MemberRole; grantedBy: string | null; via: "role_change" | "join" },
): Promise<void> {
  await tx.insert(clinicalAccessGrants).values(input);
}
