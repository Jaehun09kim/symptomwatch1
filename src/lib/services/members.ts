import { and, asc, eq } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { memberships, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import type { MemberRole, TaskCategory } from "@/lib/labels";
import { ServiceError } from "./errors";

export interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: MemberRole;
  status: "active" | "disabled";
  isPlaceholder: boolean;
}

export async function listMembersTx(tx: DbTransaction, ctx: AppContext): Promise<Member[]> {
  return tx
    .select({
      userId: memberships.userId,
      displayName: users.displayName,
      email: users.email,
      role: memberships.role,
      status: memberships.status,
      isPlaceholder: users.isPlaceholder,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.clinicId, ctx.clinicId))
    .orderBy(asc(users.displayName));
}

export async function listMembers(ctx: AppContext, database?: DatabaseHandle): Promise<Member[]> {
  return withTenant(ctx, (tx) => listMembersTx(tx, ctx), database);
}

/** Clinical review tasks may only be assigned to physicians; everything else to any active member. */
export function canBeAssigned(member: Pick<Member, "role" | "status">, category: TaskCategory): boolean {
  if (member.status !== "active") return false;
  return category === "clinical_review" ? member.role === "physician" : true;
}

export async function assertAssignable(tx: DbTransaction, ctx: AppContext, userId: string, category: TaskCategory): Promise<void> {
  const [member] = await tx
    .select({ role: memberships.role, status: memberships.status })
    .from(memberships)
    .where(and(eq(memberships.clinicId, ctx.clinicId), eq(memberships.userId, userId)));
  if (!member || !canBeAssigned(member, category)) {
    throw new ServiceError("That person can't be assigned this kind of task.");
  }
}
