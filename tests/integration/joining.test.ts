import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachJoinAccount, enterApprovedClinic, getPendingJoins, startJoin, verifyEmailAndJoin } from "@/lib/auth/joining";
import { resolveIdentitySession, resolveSession } from "@/lib/auth/session-store";
import type { AppContext } from "@/lib/authz/context";
import { joinRequests, memberships, outboxMessages } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { createJoinCode, decideJoinRequest } from "@/lib/services/join-codes";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

const MINUTE = 60_000;
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
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    expect(started).toMatchObject({ clinicName: "Harbor View Family Medicine — DEMO", role: "staff" });
    const person = newPerson();
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    expect(step).toEqual({ ok: true, next: "verify_email", email: person.email });
    expect(await verificationToken(db, person.email)).toBeTruthy();
  });

  it("instant code + verified email joins immediately", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const joined = await verifyEmailAndJoin(await verificationToken(db, person.email), {}, db);
    if (!joined.ok || joined.next !== "joined") throw new Error(`expected joined, got ${JSON.stringify(joined)}`);
    expect(await resolveSession(joined.session.token, db)).toMatchObject({ role: "staff", canManage: false, clinicId: admin.clinicId });
  });

  it("approve code puts the applicant on the waiting list", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error(`expected waiting, got ${JSON.stringify(waiting)}`);
    const pending = await getPendingJoins(waiting.session.token, db);
    expect(pending).toMatchObject([{ clinicName: "Harbor View Family Medicine — DEMO", status: "pending" }]);
  });

  it("identity-only sessions see no clinic data", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), {}, db);
    if (!waiting.ok || waiting.next !== "waiting") throw new Error("expected waiting");
    expect(await resolveSession(waiting.session.token, db)).toBeNull();
    expect(await resolveIdentitySession(waiting.session.token, db)).toMatchObject({ email: person.email });
  });

  it("approved applicant enters the clinic", async () => {
    const { display } = await code("physician", "approve");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const waiting = await verifyEmailAndJoin(await verificationToken(db, person.email), {}, db);
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
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    const later = new Date(Date.now() + 10 * MINUTE);
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db, later);
    expect(step).toMatchObject({ ok: true, next: "verify_email" });
    const joined = await verifyEmailAndJoin(await verificationToken(db, person.email), {}, db, new Date(Date.now() + 12 * MINUTE));
    expect(joined).toMatchObject({ ok: true, next: "joined" });
  });

  it("expired join transaction refuses", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const step = await attachJoinAccount(started.token, { mode: "sign_up", ...newPerson() }, {}, db, new Date(Date.now() + 16 * MINUTE));
    expect(step).toMatchObject({ ok: false, error: expect.stringMatching(/expired/i) });
  });

  it("verification link is single-use", async () => {
    const { display } = await code("staff", "instant");
    const started = await startJoin(display, {}, db);
    if (!started.ok) throw new Error(started.error);
    const person = newPerson();
    await attachJoinAccount(started.token, { mode: "sign_up", ...person }, {}, db);
    const token = await verificationToken(db, person.email);
    expect(await verifyEmailAndJoin(token, {}, db)).toMatchObject({ ok: true });
    expect(await verifyEmailAndJoin(token, {}, db)).toMatchObject({ ok: false });
  });

  it("existing members cannot rejoin through a code", async () => {
    const { display } = await code("physician", "instant");
    const started = await startJoin(display, {}, db);
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
});
