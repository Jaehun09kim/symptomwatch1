import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachJoinAccount, continueJoin, enterApprovedClinic, getPendingJoins, startJoin, verifyEmailAndJoin, withdrawJoin } from "@/lib/auth/joining";
import { signInWithPassword } from "@/lib/auth/accounts";
import { resolveIdentitySession, resolveSession } from "@/lib/auth/session-store";
import type { AppContext } from "@/lib/authz/context";
import { auditLogs, joinRequests, memberships, outboxMessages } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { cancelJoinCode, createJoinCode, decideJoinRequest } from "@/lib/services/join-codes";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

const MINUTE = 60_000;
// Each test gets its own simulated client so the per-IP code-attempt limit never leaks between tests.
let clients = 0;
const client = () => ({ ipHash: `test-client-${++clients}` });
let people = 0;
const newPerson = () => {
  people++;
  return { displayName: `Joiner ${people}`, email: `joiner${people}@example.test`, password: `a-valid-long-pass-${people}x` };
};

async function verificationToken(db: DatabaseHandle, email: string): Promise<string> {
  const [message] = await withSystem((tx) => tx.select().from(outboxMessages)
    .where(and(eq(outboxMessages.toEmail, email), eq(outboxMessages.kind, "email_verification")))
    .orderBy(desc(outboxMessages.createdAt)).limit(1), db);
  const match = message?.body.match(/\/verify-email\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`No verification email for ${email}`);
  return match[1];
}

async function membership(db: DatabaseHandle, clinicId: string, userId: string) {
  return withSystem(async (tx) => (await tx.select().from(memberships).where(and(eq(memberships.clinicId, clinicId), eq(memberships.userId, userId))))[0], db);
}

describe("joining with a code (applicant side)", () => {
  let db: DatabaseHandle;
  let admin: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    admin = await contextFor(db, "hv-admin-shah");
  });
  afterAll(async () => { await db.close(); });

  const code = (role: "physician" | "staff", approvalMode: "approve" | "instant") => createJoinCode(admin, { role, approvalMode }, db);

  it("unverified email gets a verification link in the outbox first", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    expect(started).toMatchObject({ clinicName: "Harbor View Family Medicine — DEMO", role: "staff" });
    const person = newPerson();
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    expect(step).toEqual({ ok: true, next: "verify_email", email: person.email });
    expect(await verificationToken(db, person.email)).toBeTruthy();
  });

  it("instant code + verified email joins immediately", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const joined = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    if (!joined.ok || joined.next !== "joined") throw new Error(`expected joined, got ${JSON.stringify(joined)}`);
    expect(await resolveSession(joined.session.token, db)).toMatchObject({ role: "staff", canManage: false, clinicId: admin.clinicId });
  });

  it("approve code puts the applicant on the waiting list", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error(`expected waiting, got ${JSON.stringify(waiting)}`);
    const pending = await getPendingJoins(waiting.session.token, db);
    expect(pending).toMatchObject([{ clinicName: "Harbor View Family Medicine — DEMO", status: "pending" }]);
  });

  it("identity-only sessions see no clinic data", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error("expected waiting");
    expect(await resolveSession(waiting.session.token, db)).toBeNull();
    expect(await resolveIdentitySession(waiting.session.token, db)).toMatchObject({ email: person.email });
  });

  it("approved applicant enters the clinic", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error("expected waiting");
    const [pending] = await getPendingJoins(waiting.session.token, db);
    await decideJoinRequest(admin, { requestId: pending.requestId, decision: "approve" }, db);
    expect((await getPendingJoins(waiting.session.token, db))[0].status).toBe("approved");
    const entered = await enterApprovedClinic(waiting.session.token, pending.clinicId, {}, db);
    if (!entered.ok) throw new Error(entered.error);
    expect(await resolveSession(entered.token, db)).toMatchObject({ role: "physician", clinicId: admin.clinicId });
  });

  it("join transaction outlives the code", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    const later = new Date(Date.now() + 10 * MINUTE);
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db, later);
    expect(step).toMatchObject({ ok: true, next: "verify_email" });
    const joined = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db, new Date(Date.now() + 12 * MINUTE));
    expect(joined).toMatchObject({ ok: true, next: "joined" });
  });

  it("expired join transaction refuses", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...newPerson() }, {}, db, new Date(Date.now() + 16 * MINUTE));
    expect(step).toMatchObject({ ok: false, error: expect.stringMatching(/expired/i) });
  });

  it("verification link is single-use", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const token = await verificationToken(db, person.email);
    expect(await verifyEmailAndJoin(token, started.token, {}, db)).toMatchObject({ ok: true });
    expect(await verifyEmailAndJoin(token, started.token, {}, db)).toMatchObject({ ok: false });
  });

  it("existing members cannot rejoin through a code", async () => {
    const { display } = await code("physician", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const step = await attachJoinAccount(started.token, { mode: "sign_in", email: "frontdesk@harborview.demo.test", password: "SymptomWatch-Demo-2026" }, {}, db);
    expect(step).toMatchObject({ ok: false, error: expect.stringMatching(/already belong/i) });
    const desk = await contextFor(db, "hv-fd-okafor");
    expect((await membership(db, admin.clinicId, desk.userId)).role).toBe("staff");
  });

  it("code attempts are rate limited", async () => {
    const meta = { ipHash: "rate-limit-test-ip" };
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(await startJoin("AAAA-AAAA", meta, db)).toMatchObject({ ok: false, error: expect.stringMatching(/isn't valid/) });
    }
    expect(await startJoin("AAAA-AAAA", meta, db)).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });

  it("refuses expired, cancelled and malformed codes with one generic message", async () => {
    const expired = await code("staff", "instant");
    await withSystem((tx) => tx.execute(sql`UPDATE join_codes SET expires_at = now() - interval '1 second' WHERE id = ${expired.id}`), db);
    const generic = /That code isn't valid\. Codes expire 90 seconds after they're created/;
    // Own rate-limit bucket: the other tests share the "unknown" IP bucket.
    const meta = { ipHash: "generic-message-test-ip" };
    expect(await startJoin(expired.display, meta, db)).toMatchObject({ ok: false, error: expect.stringMatching(generic) });
    expect(await startJoin("not-a-code", meta, db)).toMatchObject({ ok: false, error: expect.stringMatching(generic) });
    const rows = await withSystem((tx) => tx.select().from(joinRequests).where(eq(joinRequests.joinCodeId, expired.id)), db);
    expect(rows).toHaveLength(0);
  });

  // ── Codex review fixes ────────────────────────────────────────────────────
  it("cancelling a code between entry and confirmation refuses the join", async () => {
    for (const mode of ["instant", "approve"] as const) {
      const created = await code("staff", mode);
      const started = await startJoin(created.display, client(), db);
      if (!started.ok) throw new Error(started.error);
      const person = newPerson();
      await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
      await cancelJoinCode(admin, created.id, db);
      const result = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/cancelled/i) });
      const requests = await withSystem((tx) => tx.select().from(joinRequests).where(eq(joinRequests.joinCodeId, created.id)), db);
      expect(requests).toHaveLength(0);
    }
  });

  it("a confirmation link opened elsewhere confirms the email but signs nobody in there", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const elsewhere = await verifyEmailAndJoin(await verificationToken(db, person.email), undefined, {}, db);
    expect(elsewhere).toEqual({ ok: true, next: "verified" });
    // The browser that entered the code finishes the join.
    const finished = await continueJoin(started.token, {}, db);
    expect(finished).toMatchObject({ ok: true, next: "joined" });
  });

  it("verification after the join transaction expired refuses", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const late = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db, new Date(Date.now() + 16 * MINUTE));
    expect(late).toMatchObject({ ok: false });
  });

  it("disabled members cannot rejoin through a code", async () => {
    const nguyen = await contextFor(db, "hv-dr-nguyen");
    await withSystem((tx) => tx.update(memberships).set({ status: "disabled" }).where(and(eq(memberships.clinicId, nguyen.clinicId), eq(memberships.userId, nguyen.userId))), db);
    const { display } = await code("physician", "instant");
    const started = await startJoin(display, client(), db);
    if (!started.ok) throw new Error(started.error);
    const step = await attachJoinAccount(started.token, { mode: "sign_in", email: "nguyen@harborview.demo.test", password: "SymptomWatch-Demo-2026" }, {}, db);
    expect(step).toMatchObject({ ok: false, error: expect.stringMatching(/already belong/i) });
    await withSystem((tx) => tx.update(memberships).set({ status: "active" }).where(and(eq(memberships.clinicId, nguyen.clinicId), eq(memberships.userId, nguyen.userId))), db);
  });

  it("join sign-in shares the per-account guess limit", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, { ipHash: "account-limit-ip" }, db);
    if (!started.ok) throw new Error(started.error);
    const target = "physician@orangegrove.demo.test";
    for (let attempt = 0; attempt < 8; attempt++) {
      expect(await attachJoinAccount(started.token, { mode: "sign_in", email: target, password: `wrong-password-${attempt}` }, {}, db)).toMatchObject({ ok: false });
    }
    expect(await attachJoinAccount(started.token, { mode: "sign_in", email: target, password: "wrong-again-xx" }, {}, db))
      .toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
  });

  it("pending applicants can sign in to their waiting screen", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, { ipHash: "pending-sign-in-ip" }, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    const grant = await signInWithPassword({ email: person.email, password: person.password }, {}, db);
    expect(grant).toMatchObject({ ok: true, pending: true });
    if (!grant.ok || !("pending" in grant)) throw new Error("expected a pending grant");
    expect(await getPendingJoins(grant.token, db)).toMatchObject([{ status: "pending" }]);
  });

  it("withdrawals are audited", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, { ipHash: "withdraw-audit-ip" }, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), started.token, {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error("expected waiting");
    const [pending] = await getPendingJoins(waiting.session.token, db);
    expect(await withdrawJoin(waiting.session.token, pending.requestId, db)).toEqual({ ok: true });
    const events = await withSystem((tx) => tx.select().from(auditLogs).where(and(eq(auditLogs.action, "join_request.withdrawn"), eq(auditLogs.entityId, pending.requestId))), db);
    expect(events).toHaveLength(1);
  });
});
