import type { MemberRole } from "@/lib/labels";

/**
 * What every tenant-data service receives. `userId` is the effective user
 * (whose membership RLS evaluates); `actorUserId` is the human behind the
 * session — different only while a sandbox admin is "viewing as" a colleague.
 */
export interface AppContext {
  userId: string;
  actorUserId: string;
  clinicId: string;
  role: MemberRole;
}
