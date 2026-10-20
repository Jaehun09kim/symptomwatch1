import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { withSystem } from "@/lib/db/system";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

type Row = Record<string, unknown>;
const asRows = (result: unknown) => (result as { rows: Row[] }).rows;
const tenant = (db: DatabaseHandle, ctx: AppContext, query: ReturnType<typeof sql>) =>
  withTenant(ctx, async (tx) => asRows(await tx.execute(query)), db);

describe("0011 join codes: row-level security", () => {
  let db: DatabaseHandle;
  let admin: AppContext;
  let desk: AppContext;
  let otherClinic: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    admin = await contextFor(db, "hv-admin-shah");
    desk = await contextFor(db, "hv-fd-okafor");
    otherClinic = await contextFor(db, "og-dr-brooks");
  });
  afterAll(async () => { await db.close(); });

  it("managers create and read join codes; others cannot", async () => {
    const created = await tenant(db, admin, sql`INSERT INTO join_codes (clinic_id, role, approval_mode, code_hash, created_by)
      VALUES (${admin.clinicId}, 'physician', 'approve', 'hash-1', ${admin.userId}) RETURNING id`);
    expect(created).toHaveLength(1);
    expect(await tenant(db, admin, sql`SELECT id FROM join_codes`)).toHaveLength(1);
    expect(await tenant(db, desk, sql`SELECT id FROM join_codes`)).toHaveLength(0);
    await expect(tenant(db, desk, sql`INSERT INTO join_codes (clinic_id, role, approval_mode, code_hash, created_by)
      VALUES (${desk.clinicId}, 'staff', 'instant', 'hash-2', ${desk.userId})`)).rejects.toThrow();
  });

  it("codes default to 90 seconds", async () => {
    const [row] = await tenant(db, admin, sql`INSERT INTO join_codes (clinic_id, role, approval_mode, code_hash, created_by)
      VALUES (${admin.clinicId}, 'staff', 'instant', 'hash-3', ${admin.userId})
      RETURNING extract(epoch FROM (expires_at - created_at))::int AS seconds, approval_mode`);
    expect(row).toEqual({ seconds: 90, approval_mode: "instant" });
    const [fallback] = await tenant(db, admin, sql`INSERT INTO join_codes (clinic_id, role, code_hash, created_by)
      VALUES (${admin.clinicId}, 'staff', 'hash-4', ${admin.userId}) RETURNING approval_mode`);
    expect(fallback).toEqual({ approval_mode: "approve" });
  });

  it("applicants and sw_app cannot touch join transactions or verifications", async () => {
    for (const ctx of [admin, desk]) {
      await expect(tenant(db, ctx, sql`SELECT id FROM join_transactions`)).rejects.toThrow();
      await expect(tenant(db, ctx, sql`SELECT id FROM email_verifications`)).rejects.toThrow();
    }
  });

  it("members read their clinic's clinical access grants only", async () => {
    await withSystem((tx) => tx.execute(sql`INSERT INTO clinical_access_grants (clinic_id, user_id, role, via)
      VALUES (${admin.clinicId}, ${desk.userId}, 'physician', 'role_change')`), db);
    expect(await tenant(db, desk, sql`SELECT id FROM clinical_access_grants`)).toHaveLength(1);
    expect(await tenant(db, otherClinic, sql`SELECT id FROM clinical_access_grants`)).toHaveLength(0);
  });
});
