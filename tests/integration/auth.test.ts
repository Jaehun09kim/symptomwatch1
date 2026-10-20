import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitationAsUser,
  issueResetLinkForMember,
  listOutbox,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  signInWithPassword,
} from "@/lib/auth/accounts";
import { resolveSession } from "@/lib/auth/session-store";
import { auditLogs, clinics, memberships, patients, sessions } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { listViewAsCandidates, provisionTryDemo, returnToOwnAccount, startViewAs } from "@/lib/services/demo-sandbox";
import { inviteStaff } from "@/lib/services/staff";
import { contextFor, createSeededDatabase, userIdByEmail } from "../helpers/seeded";

const PASSWORD = "SymptomWatch-Demo-2026";

describe("authentication and sessions", () => {
  let db: DatabaseHandle;
  beforeAll(async () => { db = await createSeededDatabase(); });
  afterAll(async () => { await db.close(); });

  it("signs in a shared demo physician and resolves a session with role and clinic", async () => {
    const result = await signInWithPassword({ email: "physician@harborview.demo.test", password: PASSWORD }, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const session = await resolveSession(result.token, db);
    expect(session).toMatchObject({ role: "physician", clinicName: "Harbor View Family Medicine — DEMO", isSandbox: false });
  });

  it("rejects a wrong password with a generic message and audits the failure", async () => {
    const result = await signInWithPassword({ email: "physician@harborview.demo.test", password: "wrong-password-123" }, {}, db);
    expect(result).toEqual({ ok: false, error: "That email and password don't match an account." });
    const unknown = await signInWithPassword({ email: "nobody@example.test", password: "whatever-12345" }, {}, db);
    expect(unknown).toEqual(result);
    const failures = await withSystem((tx) => tx.select().from(auditLogs).where(eq(auditLogs.action, "auth.sign_in_failed")), db);
    expect(failures.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a forged or unknown session token", async () => {
    expect(await resolveSession("not-a-real-token", db)).toBeNull();
  });

  it("registers an account with a private 30-patient sandbox clinic and admin role", async () => {
    const result = await registerAccount({ displayName: "Avery Demo", email: "avery@example.test", password: "a-strong-demo-pass", clinicName: "Seaside Clinic" }, {}, db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const session = await resolveSession(result.token, db);
    expect(session).toMatchObject({ role: "clinic_admin", clinicName: "Seaside Clinic — DEMO", isSandbox: true });
    const [{ count }] = await withSystem((tx) => tx.select({ count: sql<number>`count(*)::int` }).from(patients).where(eq(patients.clinicId, result.clinicId)), db);
    expect(count).toBe(30);
    const [clinic] = await withSystem((tx) => tx.select({ expiresAt: clinics.expiresAt }).from(clinics).where(eq(clinics.id, result.clinicId)), db);
    const days = (new Date(clinic.expiresAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("refuses duplicate emails and weak passwords", async () => {
    const duplicate = await registerAccount({ displayName: "Avery Again", email: "avery@example.test", password: "another-strong-pass" }, {}, db);
    expect(duplicate).toMatchObject({ ok: false, field: "email" });
    const weak = await registerAccount({ displayName: "Weak", email: "weak@example.test", password: "password123" }, {}, db);
    expect(weak).toMatchObject({ ok: false, field: "password" });
  });

  it("invalidates sessions for disabled members and expired sandboxes", async () => {
    const grant = await signInWithPassword({ email: "frontdesk@harborview.demo.test", password: PASSWORD }, {}, db);
    if (!grant.ok) throw new Error("sign-in failed");
    await withSystem((tx) => tx.update(memberships).set({ status: "disabled" }).where(and(eq(memberships.userId, grant.userId), eq(memberships.clinicId, grant.clinicId))), db);
    expect(await resolveSession(grant.token, db)).toBeNull();
    await withSystem((tx) => tx.update(memberships).set({ status: "active" }).where(eq(memberships.userId, grant.userId)), db);

    const demo = await provisionTryDemo("staff", {}, db);
    expect(await resolveSession(demo.token, db)).not.toBeNull();
    await withSystem((tx) => tx.update(clinics).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(clinics.id, demo.clinicId)), db);
    expect(await resolveSession(demo.token, db)).toBeNull();
  });

  it("expires idle sessions", async () => {
    const grant = await signInWithPassword({ email: "physician@harborview.demo.test", password: PASSWORD }, {}, db);
    if (!grant.ok) throw new Error("sign-in failed");
    await withSystem((tx) => tx.update(sessions).set({ lastSeenAt: new Date(Date.now() - 13 * 3_600_000).toISOString() }).where(eq(sessions.userId, grant.userId)), db);
    expect(await resolveSession(grant.token, db)).toBeNull();
  });

  it("resets a password with a single-use token and revokes existing sessions", async () => {
    const before = await signInWithPassword({ email: "avery@example.test", password: "a-strong-demo-pass" }, {}, db);
    if (!before.ok) throw new Error("sign-in failed");
    await requestPasswordReset("avery@example.test", {}, db);
    await requestPasswordReset("nobody@example.test", {}, db); // same behavior, no message
    const message = (await listOutbox(db)).find((entry) => entry.toEmail === "avery@example.test" && entry.kind === "password_reset");
    const token = message?.body.match(/reset-password\/([\w-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect((await listOutbox(db)).some((entry) => entry.toEmail === "nobody@example.test")).toBe(false);

    expect(await resetPassword({ token: token!, password: "short" }, {}, db)).toMatchObject({ ok: false, field: "password" });
    expect(await resetPassword({ token: token!, password: "a-new-strong-pass" }, {}, db)).toEqual({ ok: true });
    expect(await resetPassword({ token: token!, password: "a-third-strong-pass" }, {}, db)).toMatchObject({ ok: false });
    expect(await resolveSession(before.token, db)).toBeNull();
    expect((await signInWithPassword({ email: "avery@example.test", password: "a-new-strong-pass" }, {}, db)).ok).toBe(true);
  });

  it("invalidates every other outstanding reset link once a password is reset", async () => {
    await requestPasswordReset("avery@example.test", {}, db);
    await requestPasswordReset("avery@example.test", {}, db);
    const tokens = (await listOutbox(db))
      .filter((entry) => entry.toEmail === "avery@example.test" && entry.kind === "password_reset")
      .map((entry) => entry.body.match(/reset-password\/([\w-]+)/)![1]);
    const [second, first] = tokens; // newest first
    expect(await resetPassword({ token: second, password: "another-strong-pass" }, {}, db)).toEqual({ ok: true });
    expect(await resetPassword({ token: first, password: "attacker-strong-pass" }, {}, db)).toMatchObject({ ok: false });
  });

  it("lets an admin issue a reset link only for real members of their clinic", async () => {
    const admin = await contextFor(db, "hv-admin-shah");
    const physician = await contextFor(db, "hv-dr-rivera");
    const ok = await issueResetLinkForMember({ adminUserId: admin.userId, clinicId: admin.clinicId, memberUserId: physician.userId }, db);
    expect(ok).toMatchObject({ ok: true });
    const notAdmin = await issueResetLinkForMember({ adminUserId: physician.userId, clinicId: admin.clinicId, memberUserId: admin.userId }, db);
    expect(notAdmin.ok).toBe(false);
    const otherClinic = await contextFor(db, "og-dr-brooks");
    const crossTenant = await issueResetLinkForMember({ adminUserId: admin.userId, clinicId: admin.clinicId, memberUserId: otherClinic.userId }, db);
    expect(crossTenant.ok).toBe(false);
  });
});

describe("invitations", () => {
  let db: DatabaseHandle;
  beforeAll(async () => { db = await createSeededDatabase(); });
  afterAll(async () => { await db.close(); });

  it("joins the inviting clinic with the invited role; tokens are single-use and email-bound", async () => {
    const admin = await contextFor(db, "hv-admin-shah");
    const { link } = await inviteStaff(admin, { email: "new.nurse@example.test", role: "staff" }, db);
    const token = link.split("/invite/")[1];

    const wrongEmail = await registerAccount({ displayName: "Imposter", email: "imposter@example.test", password: "a-valid-long-pass-1", inviteToken: token }, {}, db);
    expect(wrongEmail).toMatchObject({ ok: false, field: "email" });
    expect(await userIdByEmail(db, "imposter@example.test")).toBeUndefined();

    const joined = await registerAccount({ displayName: "New Nurse", email: "new.nurse@example.test", password: "a-valid-long-pass-3", inviteToken: token }, {}, db);
    expect(joined).toMatchObject({ ok: true, clinicId: admin.clinicId });
    if (!joined.ok) return;
    expect((await resolveSession(joined.token, db))?.role).toBe("staff");

    const reuse = await registerAccount({ displayName: "Again", email: "again@example.test", password: "a-valid-long-pass-4", inviteToken: token }, {}, db);
    expect(reuse.ok).toBe(false);
    expect((await listOutbox(db)).some((entry) => entry.kind === "invitation" && entry.toEmail === "new.nurse@example.test")).toBe(true);
  });

  it("lets an existing user accept an invitation into a second clinic", async () => {
    const ogAdmin = await contextFor(db, "og-admin-kim");
    const { link } = await inviteStaff(ogAdmin, { email: "physician@harborview.demo.test", role: "physician" }, db);
    const userId = (await userIdByEmail(db, "physician@harborview.demo.test"))!;
    const wrongUser = await acceptInvitationAsUser(link.split("/invite/")[1], { id: userId, email: "someone@else.test" }, {}, db);
    expect(wrongUser.ok).toBe(false);
    const accepted = await acceptInvitationAsUser(link.split("/invite/")[1], { id: userId, email: "physician@harborview.demo.test" }, {}, db);
    expect(accepted).toMatchObject({ ok: true, clinicId: ogAdmin.clinicId });
  });

  it("refuses admin-issued reset links for people who belong to another clinic", async () => {
    // Dr. Rivera now belongs to both clinics; a reset link would let one clinic's admin into the other.
    const admin = await contextFor(db, "hv-admin-shah");
    const rivera = (await userIdByEmail(db, "physician@harborview.demo.test"))!;
    const result = await issueResetLinkForMember({ adminUserId: admin.userId, clinicId: admin.clinicId, memberUserId: rivera }, db);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/another clinic/i) });
  });

  it("allows only one outstanding invitation per clinic and address", async () => {
    const admin = await contextFor(db, "hv-admin-shah");
    await inviteStaff(admin, { email: "twice@example.test", role: "staff" }, db);
    await expect(withSystem((tx) => tx.execute(sql`
      insert into invitations (clinic_id, email, role, token_hash, invited_by, expires_at)
      values (${admin.clinicId}, 'twice@example.test', 'clinic_admin', 'forged-hash', ${admin.userId}, now() + interval '1 day')`), db)).rejects.toThrow();
  });
});

describe("demo sandboxes and view-as", () => {
  let db: DatabaseHandle;
  beforeAll(async () => { db = await createSeededDatabase(); });
  afterAll(async () => { await db.close(); });

  it("provisions an isolated Try-Demo sandbox per visitor", async () => {
    const a = await provisionTryDemo("physician", {}, db);
    const b = await provisionTryDemo("physician", {}, db);
    expect(a.clinicId).not.toBe(b.clinicId);
    const session = await resolveSession(a.token, db);
    expect(session).toMatchObject({ role: "physician", isSandbox: true, isPlaceholder: true });
  });

  it("lets a Try-Demo visitor switch to fictional colleagues inside their own sandbox only", async () => {
    const demo = await provisionTryDemo("physician", {}, db);
    const session = (await resolveSession(demo.token, db))!;
    const candidates = await listViewAsCandidates(session, db);
    expect(candidates.map((candidate) => candidate.role).sort()).toEqual(["clinic_admin", "physician", "staff", "staff"]);
    const frontDesk = candidates.find((candidate) => candidate.role === "staff")!;
    const switched = await startViewAs(session, frontDesk.userId, {}, db);
    if (!switched.ok) throw new Error(switched.error);
    expect(await resolveSession(switched.token, db)).toMatchObject({ role: "staff", originalUserId: null });

    const other = await provisionTryDemo("staff", {}, db);
    const otherSession = (await resolveSession(other.token, db))!;
    const [foreign] = await listViewAsCandidates(otherSession, db);
    expect((await startViewAs(session, foreign.userId, {}, db)).ok).toBe(false);
  });

  it("keeps the real admin as original user while viewing as, and returns to them", async () => {
    const owner = await registerAccount({ displayName: "Owner Person", email: "owner@example.test", password: "a-valid-long-pass-2" }, {}, db);
    if (!owner.ok) throw new Error(owner.error);
    const session = (await resolveSession(owner.token, db))!;
    const physician = (await listViewAsCandidates(session, db)).find((candidate) => candidate.role === "physician")!;
    const viewing = await startViewAs(session, physician.userId, {}, db);
    if (!viewing.ok) throw new Error(viewing.error);
    const viewingSession = (await resolveSession(viewing.token, db))!;
    expect(viewingSession).toMatchObject({ role: "physician", originalUserId: owner.userId });
    // A view-as session lives only as long as the human behind it still manages the clinic.
    await withSystem((tx) => tx.update(memberships).set({ canManage: false }).where(and(eq(memberships.userId, owner.userId), eq(memberships.clinicId, owner.clinicId))), db);
    expect(await resolveSession(viewing.token, db)).toBeNull();
    await withSystem((tx) => tx.update(memberships).set({ canManage: true }).where(and(eq(memberships.userId, owner.userId), eq(memberships.clinicId, owner.clinicId))), db);
    const again = await startViewAs(session, physician.userId, {}, db);
    if (!again.ok) throw new Error(again.error);
    const back = await returnToOwnAccount((await resolveSession(again.token, db))!, {}, db);
    if (!back.ok) throw new Error(back.error);
    expect(await resolveSession(back.token, db)).toMatchObject({ userId: owner.userId, role: "clinic_admin", originalUserId: null });
  });

  it("offers no view-as in the shared (non-sandbox) clinics", async () => {
    const grant = await signInWithPassword({ email: "admin@harborview.demo.test", password: PASSWORD }, {}, db);
    if (!grant.ok) throw new Error("sign-in failed");
    expect(await listViewAsCandidates((await resolveSession(grant.token, db))!, db)).toEqual([]);
  });
});
