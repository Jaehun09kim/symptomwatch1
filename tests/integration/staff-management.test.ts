import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueResetLinkForMember, registerAccount } from "@/lib/auth/accounts";
import type { AppContext } from "@/lib/authz/context";
import { auditLogs, memberships, users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { changeMemberRole, inviteStaff, setMemberCanManage, setMemberStatus } from "@/lib/services/staff";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

const SELF_ERROR = "You can't change your own access. Ask another manager.";
const LAST_MANAGER_ERROR = "A clinic needs at least one active manager.";

async function membership(db: DatabaseHandle, clinicId: string, userId: string) {
  return withSystem(async (tx) => (await tx.select().from(memberships)
    .where(and(eq(memberships.clinicId, clinicId), eq(memberships.userId, userId))))[0], db);
}

async function contextIn(db: DatabaseHandle, clinicId: string, userId: string): Promise<AppContext> {
  const row = await membership(db, clinicId, userId);
  return { userId, actorUserId: userId, clinicId, role: row.role, canManage: row.canManage };
}

async function lastAudit(db: DatabaseHandle, clinicId: string, action: string) {
  return withSystem(async (tx) => (await tx.select().from(auditLogs)
    .where(and(eq(auditLogs.clinicId, clinicId), eq(auditLogs.action, action))).orderBy(desc(auditLogs.createdAt)).limit(1))[0], db);
}

/** A sandbox clinic whose only human is its registered owner; seeded colleagues are placeholders. */
async function sandbox(db: DatabaseHandle, email: string) {
  const owner = await registerAccount({ displayName: "Sandbox Owner", email, password: "a-valid-long-pass-9" }, {}, db);
  if (!owner.ok) throw new Error(owner.error);
  const placeholderAdmin = await withSystem(async (tx) => (await tx.select({ userId: memberships.userId }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.clinicId, owner.clinicId), eq(memberships.role, "clinic_admin"), eq(users.isPlaceholder, true))))[0], db);
  return { owner: await contextIn(db, owner.clinicId, owner.userId), placeholderAdmin: await contextIn(db, owner.clinicId, placeholderAdmin.userId) };
}

describe("membership management with the manager flag", () => {
  let db: DatabaseHandle;
  let admin: AppContext;
  let desk: AppContext;
  let physician: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    admin = await contextFor(db, "hv-admin-shah");
    desk = await contextFor(db, "hv-fd-okafor");
    physician = await contextFor(db, "hv-dr-rivera");
  });
  afterAll(async () => { await db.close(); });

  it("seeded admins are managers", async () => {
    expect((await membership(db, admin.clinicId, admin.userId)).canManage).toBe(true);
    expect((await membership(db, physician.clinicId, physician.userId)).canManage).toBe(false);
    expect((await membership(db, desk.clinicId, desk.userId)).canManage).toBe(false);
    const { owner } = await sandbox(db, "seeded-owner@example.test");
    expect(owner.canManage).toBe(true);
  });

  it("managers toggle another member's manager flag", async () => {
    await setMemberCanManage(admin, { userId: desk.userId, canManage: true }, db);
    expect((await membership(db, desk.clinicId, desk.userId)).canManage).toBe(true);
    expect((await lastAudit(db, admin.clinicId, "membership.manage_changed"))?.metadata).toMatchObject({ from: false, to: true });
    await setMemberCanManage(admin, { userId: desk.userId, canManage: false }, db);
  });

  it("refuses self role and self flag changes", async () => {
    await expect(changeMemberRole(admin, { userId: admin.userId, role: "physician" }, db)).rejects.toThrow(SELF_ERROR);
    await expect(setMemberCanManage(admin, { userId: admin.userId, canManage: false }, db)).rejects.toThrow(SELF_ERROR);
  });

  it("keeps a human manager", async () => {
    const { owner, placeholderAdmin } = await sandbox(db, "last-manager@example.test");
    expect(placeholderAdmin.canManage).toBe(true);
    await expect(setMemberCanManage(placeholderAdmin, { userId: owner.userId, canManage: false }, db)).rejects.toThrow(LAST_MANAGER_ERROR);
    await expect(setMemberStatus(placeholderAdmin, { userId: owner.userId, status: "disabled" }, db)).rejects.toThrow(LAST_MANAGER_ERROR);
  });

  it("concurrent removals keep one manager", async () => {
    await setMemberCanManage(admin, { userId: desk.userId, canManage: true }, db);
    const deskManager = await contextIn(db, desk.clinicId, desk.userId);
    const results = await Promise.allSettled([
      setMemberCanManage(admin, { userId: desk.userId, canManage: false }, db),
      setMemberCanManage(deskManager, { userId: admin.userId, canManage: false }, db),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const managers = await withSystem((tx) => tx.select({ userId: memberships.userId }).from(memberships)
      .where(and(eq(memberships.clinicId, admin.clinicId), eq(memberships.canManage, true))), db);
    expect(managers).toHaveLength(1);
    if (managers[0].userId === desk.userId) {
      await setMemberCanManage(deskManager, { userId: admin.userId, canManage: true }, db);
      await setMemberCanManage(admin, { userId: desk.userId, canManage: false }, db);
    }
  });

  it("invited practice admin is not a manager", async () => {
    const { link } = await inviteStaff(admin, { email: "new.practice.admin@example.test", role: "clinic_admin" }, db);
    const joined = await registerAccount({ displayName: "New Practice Admin", email: "new.practice.admin@example.test", password: "a-valid-long-pass-5", inviteToken: link.split("/invite/")[1] }, {}, db);
    if (!joined.ok) throw new Error(joined.error);
    expect(await membership(db, admin.clinicId, joined.userId)).toMatchObject({ role: "clinic_admin", canManage: false });
  });

  it("reset links only in sandboxes", async () => {
    const shared = await issueResetLinkForMember({ adminUserId: admin.userId, clinicId: admin.clinicId, memberUserId: desk.userId }, db);
    expect(shared).toEqual({ ok: false, error: "Reset links are only available in demo workspaces. Ask the person to use Forgot password." });

    const { owner } = await sandbox(db, "reset-owner@example.test");
    const { link } = await inviteStaff(owner, { email: "sandbox.colleague@example.test", role: "staff" }, db);
    const colleague = await registerAccount({ displayName: "Sandbox Colleague", email: "sandbox.colleague@example.test", password: "a-valid-long-pass-6", inviteToken: link.split("/invite/")[1] }, {}, db);
    if (!colleague.ok) throw new Error(colleague.error);
    const issued = await issueResetLinkForMember({ adminUserId: owner.userId, clinicId: owner.clinicId, memberUserId: colleague.userId }, db);
    expect(issued.ok).toBe(true);
  });

  it("clinical grants are flagged in the audit log", async () => {
    await changeMemberRole(admin, { userId: desk.userId, role: "physician" }, db);
    expect((await lastAudit(db, admin.clinicId, "membership.role_changed"))?.metadata).toMatchObject({ from: "staff", to: "physician", clinicalGrant: true });
    await changeMemberRole(admin, { userId: desk.userId, role: "staff" }, db);
    expect((await lastAudit(db, admin.clinicId, "membership.role_changed"))?.metadata).not.toHaveProperty("clinicalGrant");
  });
});
