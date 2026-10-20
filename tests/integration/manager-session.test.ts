import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerAccount, signInWithPassword } from "@/lib/auth/accounts";
import { resolveSession } from "@/lib/auth/session-store";
import { memberships } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { listViewAsCandidates, startViewAs } from "@/lib/services/demo-sandbox";
import { createSeededDatabase } from "../helpers/seeded";

const PASSWORD = "SymptomWatch-Demo-2026";

describe("sessions and the manager flag", () => {
  let db: DatabaseHandle;
  beforeAll(async () => { db = await createSeededDatabase(); });
  afterAll(async () => { await db.close(); });

  it("session reflects can_manage changes immediately", async () => {
    const grant = await signInWithPassword({ email: "frontdesk@harborview.demo.test", password: PASSWORD }, {}, db);
    if (!grant.ok) throw new Error("sign-in failed");
    expect(await resolveSession(grant.token, db)).toMatchObject({ role: "staff", canManage: false });
    const where = and(eq(memberships.userId, grant.userId), eq(memberships.clinicId, grant.clinicId));
    await withSystem((tx) => tx.update(memberships).set({ canManage: true }).where(where), db);
    expect(await resolveSession(grant.token, db)).toMatchObject({ role: "staff", canManage: true });
    await withSystem((tx) => tx.update(memberships).set({ canManage: false }).where(where), db);
  });

  it("view-as ends when the actor stops managing", async () => {
    const owner = await registerAccount({ displayName: "Owner Manager", email: "owner-manager@example.test", password: "a-valid-long-pass-2" }, {}, db);
    if (!owner.ok) throw new Error(owner.error);
    const session = (await resolveSession(owner.token, db))!;
    expect(session.canManage).toBe(true);
    const target = (await listViewAsCandidates(session, db)).find((candidate) => candidate.role === "physician")!;
    const viewing = await startViewAs(session, target.userId, {}, db);
    if (!viewing.ok) throw new Error(viewing.error);
    expect(await resolveSession(viewing.token, db)).not.toBeNull();
    await withSystem((tx) => tx.update(memberships).set({ canManage: false })
      .where(and(eq(memberships.userId, owner.userId), eq(memberships.clinicId, owner.clinicId))), db);
    expect(await resolveSession(viewing.token, db)).toBeNull();
  });
});
