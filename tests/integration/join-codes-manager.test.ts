import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { clinicalAccessGrants, joinCodes, joinRequests, memberships } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { cancelJoinCode, createJoinCode, decideJoinRequest, listJoinRequests, listRecentClinicalGrants } from "@/lib/services/join-codes";
import { changeMemberRole } from "@/lib/services/staff";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

let applicantCount = 0;
async function applicant(db: DatabaseHandle, verified = true): Promise<string> {
  applicantCount++;
  const result = await withSystem((tx) => tx.execute(sql`INSERT INTO users (email, display_name, email_verified_at)
    VALUES (${`applicant${applicantCount}@example.test`}, ${`Applicant ${applicantCount}`}, ${verified ? sql`now()` : null}) RETURNING id`), db);
  return (result as unknown as { rows: Array<{ id: string }> }).rows[0].id;
}

async function pendingRequest(db: DatabaseHandle, codeId: string, clinicId: string, userId: string, role: "physician" | "staff" = "physician"): Promise<string> {
  const [row] = await withSystem((tx) => tx.insert(joinRequests).values({ clinicId, userId, requestedRole: role, joinCodeId: codeId }).returning({ id: joinRequests.id }), db);
  return row.id;
}

async function membershipOf(db: DatabaseHandle, clinicId: string, userId: string) {
  return withSystem(async (tx) => (await tx.select().from(memberships).where(and(eq(memberships.clinicId, clinicId), eq(memberships.userId, userId))))[0], db);
}

async function requestStatus(db: DatabaseHandle, id: string) {
  return withSystem(async (tx) => (await tx.select().from(joinRequests).where(eq(joinRequests.id, id)))[0], db);
}

describe("join codes: manager services", () => {
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

  it("managers create a 90-second code and non-managers cannot", async () => {
    const before = Date.now();
    const code = await createJoinCode(admin, { role: "physician", approvalMode: "approve" }, db);
    expect(code.display).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const seconds = (new Date(code.expiresAt).getTime() - before) / 1000;
    expect(seconds).toBeGreaterThan(85);
    expect(seconds).toBeLessThanOrEqual(92);
    await expect(createJoinCode(desk, { role: "staff", approvalMode: "instant" }, db)).rejects.toThrow(/Only clinic managers/);
  });

  it("approving creates a membership without manager access and records a clinical grant", async () => {
    const code = await createJoinCode(admin, { role: "physician", approvalMode: "approve" }, db);
    const userId = await applicant(db);
    const requestId = await pendingRequest(db, code.id, admin.clinicId, userId);
    const listed = await listJoinRequests(admin, db);
    expect(listed.find((row) => row.id === requestId)).toMatchObject({ userId, emailVerified: true, requestedRole: "physician" });
    await decideJoinRequest(admin, { requestId, decision: "approve" }, db);
    expect(await membershipOf(db, admin.clinicId, userId)).toMatchObject({ role: "physician", canManage: false, status: "active" });
    expect(await requestStatus(db, requestId)).toMatchObject({ status: "approved", decidedRole: "physician", decidedBy: admin.userId });
    const grants = await withSystem((tx) => tx.select().from(clinicalAccessGrants).where(eq(clinicalAccessGrants.userId, userId)), db);
    expect(grants).toMatchObject([{ role: "physician", via: "join", grantedBy: admin.userId }]);
  });

  it("declining leaves no membership", async () => {
    const code = await createJoinCode(admin, { role: "staff", approvalMode: "approve" }, db);
    const userId = await applicant(db);
    const requestId = await pendingRequest(db, code.id, admin.clinicId, userId, "staff");
    await decideJoinRequest(admin, { requestId, decision: "decline" }, db);
    expect(await membershipOf(db, admin.clinicId, userId)).toBeUndefined();
    expect((await requestStatus(db, requestId)).status).toBe("declined");
  });

  it("cancelling a code declines its pending requests", async () => {
    const code = await createJoinCode(admin, { role: "physician", approvalMode: "approve" }, db);
    const requestId = await pendingRequest(db, code.id, admin.clinicId, await applicant(db));
    await cancelJoinCode(admin, code.id, db);
    expect((await requestStatus(db, requestId)).status).toBe("declined");
    const [row] = await withSystem((tx) => tx.select({ revokedAt: joinCodes.revokedAt }).from(joinCodes).where(eq(joinCodes.id, code.id)), db);
    expect(row.revokedAt).not.toBeNull();
  });

  it("decisions are single and atomic", async () => {
    const code = await createJoinCode(admin, { role: "staff", approvalMode: "approve" }, db);
    const userA = await applicant(db);
    const requestA = await pendingRequest(db, code.id, admin.clinicId, userA, "staff");
    await Promise.allSettled([
      decideJoinRequest(admin, { requestId: requestA, decision: "approve" }, db),
      withSystem((tx) => tx.update(joinRequests).set({ status: "withdrawn" }).where(and(eq(joinRequests.id, requestA), eq(joinRequests.status, "pending"))), db),
    ]);
    const finalA = await requestStatus(db, requestA);
    expect(["approved", "withdrawn"]).toContain(finalA.status);
    expect(Boolean(await membershipOf(db, admin.clinicId, userA))).toBe(finalA.status === "approved");

    await withSystem((tx) => tx.update(memberships).set({ canManage: true }).where(and(eq(memberships.clinicId, desk.clinicId), eq(memberships.userId, desk.userId))), db);
    const deskManager = { ...desk, canManage: true };
    const userB = await applicant(db);
    const requestB = await pendingRequest(db, code.id, admin.clinicId, userB, "staff");
    const results = await Promise.allSettled([
      decideJoinRequest(admin, { requestId: requestB, decision: "approve" }, db),
      decideJoinRequest(deskManager, { requestId: requestB, decision: "approve" }, db),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await membershipOf(db, admin.clinicId, userB)).toMatchObject({ role: "staff" });
    await withSystem((tx) => tx.update(memberships).set({ canManage: false }).where(and(eq(memberships.clinicId, desk.clinicId), eq(memberships.userId, desk.userId))), db);
  });

  it("role changes that grant clinical access are visible to physicians", async () => {
    await changeMemberRole(admin, { userId: desk.userId, role: "physician" }, db);
    const grants = await listRecentClinicalGrants(physician, db);
    expect(grants.find((grant) => grant.userName === "Daniel Okafor")).toMatchObject({ role: "physician", via: "role_change", grantedByName: "Priya Shah" });
    await changeMemberRole(admin, { userId: desk.userId, role: "staff" }, db);
  });
});
