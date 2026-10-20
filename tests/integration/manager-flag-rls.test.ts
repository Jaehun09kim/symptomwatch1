import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { createDatabase } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { bundledMigrations } from "@/lib/db/migrations.generated";
import { withSystem } from "@/lib/db/system";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

async function setCanManage(db: DatabaseHandle, ctx: AppContext, value: boolean): Promise<void> {
  await withSystem((tx) => tx.execute(sql`UPDATE memberships SET can_manage = ${value} WHERE clinic_id = ${ctx.clinicId} AND user_id = ${ctx.userId}`), db);
}

async function rows<T = Record<string, unknown>>(db: DatabaseHandle, ctx: AppContext, query: ReturnType<typeof sql>): Promise<T[]> {
  return withTenant(ctx, async (tx) => ((await tx.execute(query)) as unknown as { rows: T[] }).rows, db);
}

describe("0009 manager flag: backfill on an existing database", () => {
  it("backfills managers from clinic_admin on a populated database", async () => {
    const db = await createDatabase({ driver: "pglite", dataDir: "memory://" });
    try {
      await migrate(db, bundledMigrations.filter((migration) => migration.name < "0009"));
      await db.rawTransaction(async (tx) => {
        await tx.exec(`
          INSERT INTO users (id, email, display_name) VALUES
            ('00000000-0000-4000-8000-000000000001', 'admin@upgrade.demo.test', 'Upgrade Admin'),
            ('00000000-0000-4000-8000-000000000002', 'doc@upgrade.demo.test', 'Upgrade Doctor'),
            ('00000000-0000-4000-8000-000000000003', 'desk@upgrade.demo.test', 'Upgrade Desk');
          INSERT INTO clinics (id, name, slug) VALUES ('00000000-0000-4000-8000-0000000000c1', 'Upgrade Clinic', 'upgrade-clinic');
          INSERT INTO memberships (clinic_id, user_id, role) VALUES
            ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'clinic_admin'),
            ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000002', 'physician'),
            ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000003', 'staff');
        `);
      });
      await migrate(db);
      const result = await db.rawTransaction((tx) => tx.query<{ role: string; can_manage: boolean }>(
        "SELECT role, can_manage FROM memberships WHERE clinic_id = '00000000-0000-4000-8000-0000000000c1' ORDER BY role"));
      expect(result).toEqual([
        { role: "clinic_admin", can_manage: true },
        { role: "physician", can_manage: false },
        { role: "staff", can_manage: false },
      ]);
    } finally {
      await db.close();
    }
  });
});

describe("0009 manager flag: row-level security", () => {
  let db: DatabaseHandle;
  let physician: AppContext;
  let desk: AppContext;
  let deskTwo: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    physician = await contextFor(db, "hv-dr-rivera");
    desk = await contextFor(db, "hv-fd-okafor");
    deskTwo = await contextFor(db, "hv-fd-morales");
    await withSystem((tx) => tx.execute(sql`INSERT INTO audit_logs (clinic_id, action, entity_type) VALUES (${desk.clinicId}, 'test.event', 'test')`), db);
  });
  afterAll(async () => { await db.close(); });

  it("only managers can write memberships and read the audit log", async () => {
    expect(await rows(db, physician, sql`SELECT id FROM audit_logs`)).toHaveLength(0);
    const blocked = await rows(db, physician, sql`UPDATE memberships SET role = 'staff' WHERE clinic_id = ${deskTwo.clinicId} AND user_id = ${deskTwo.userId} RETURNING id`)
      .catch(() => []);
    expect(blocked).toHaveLength(0);

    await setCanManage(db, desk, true);
    expect((await rows(db, desk, sql`SELECT id FROM audit_logs`)).length).toBeGreaterThan(0);
    const changed = await rows(db, desk, sql`UPDATE memberships SET role = 'staff' WHERE clinic_id = ${deskTwo.clinicId} AND user_id = ${deskTwo.userId} RETURNING id`);
    expect(changed).toHaveLength(1);
    await setCanManage(db, desk, false);
  });

  it("manager flag never grants clinical reads", async () => {
    await setCanManage(db, desk, true);
    expect(await rows(db, desk, sql`SELECT id FROM encounters`)).toHaveLength(0);
    expect(await rows(db, desk, sql`SELECT id FROM lab_orders`)).toHaveLength(0);
    await setCanManage(db, desk, false);
  });

  it("trigger blocks self role and can_manage changes", async () => {
    await setCanManage(db, desk, true);
    await expect(rows(db, desk, sql`UPDATE memberships SET role = 'physician' WHERE clinic_id = ${desk.clinicId} AND user_id = ${desk.userId} RETURNING id`)).rejects.toThrow();
    await expect(rows(db, desk, sql`UPDATE memberships SET can_manage = false WHERE clinic_id = ${desk.clinicId} AND user_id = ${desk.userId} RETURNING id`)).rejects.toThrow();
    await setCanManage(db, desk, false);
  });

  it("tenant path cannot delete memberships or replace one's own", async () => {
    await setCanManage(db, desk, true);
    await expect(rows(db, desk, sql`DELETE FROM memberships WHERE clinic_id = ${deskTwo.clinicId} AND user_id = ${deskTwo.userId} RETURNING id`)).rejects.toThrow();
    // Codex review: delete-and-reinsert one's own row in one statement bypassed the UPDATE-only trigger.
    await expect(rows(db, desk, sql`
      WITH gone AS (DELETE FROM memberships WHERE clinic_id = ${desk.clinicId} AND user_id = ${desk.userId} RETURNING clinic_id, user_id)
      INSERT INTO memberships (clinic_id, user_id, role, status, can_manage) SELECT clinic_id, user_id, 'physician', 'active', true FROM gone RETURNING id`)).rejects.toThrow();
    expect((await withSystem((tx) => tx.execute(sql`SELECT role FROM memberships WHERE clinic_id = ${desk.clinicId} AND user_id = ${desk.userId}`), db) as unknown as { rows: Array<{ role: string }> }).rows[0].role).toBe("staff");
    await setCanManage(db, desk, false);
  });

  it("tenant inserts cannot grant management and identity columns are immutable", async () => {
    await setCanManage(db, desk, true);
    await expect(rows(db, desk, sql`UPDATE memberships SET user_id = ${desk.userId} WHERE clinic_id = ${deskTwo.clinicId} AND user_id = ${deskTwo.userId} RETURNING id`)).rejects.toThrow();
    const outsider = (await withSystem((tx) => tx.execute(sql`INSERT INTO users (email, display_name) VALUES ('outsider@example.test', 'Outsider') RETURNING id`), db) as unknown as { rows: Array<{ id: string }> }).rows[0].id;
    await expect(rows(db, desk, sql`INSERT INTO memberships (clinic_id, user_id, role, can_manage) VALUES (${desk.clinicId}, ${outsider}, 'staff', true) RETURNING id`)).rejects.toThrow();
    await setCanManage(db, desk, false);
  });

  it("the last human manager survives direct SQL", async () => {
    const admin = await contextFor(db, "hv-admin-shah");
    // Self-disable is a self-change.
    await expect(rows(db, admin, sql`UPDATE memberships SET status = 'disabled' WHERE clinic_id = ${admin.clinicId} AND user_id = ${admin.userId} RETURNING id`)).rejects.toThrow();
    // With two human managers, one may remove the other's management.
    await setCanManage(db, desk, true);
    expect(await rows(db, desk, sql`UPDATE memberships SET can_manage = false WHERE clinic_id = ${admin.clinicId} AND user_id = ${admin.userId} RETURNING id`)).toHaveLength(1);
    // Restore admin, then admin removes desk's management.
    await withSystem((tx) => tx.execute(sql`UPDATE memberships SET can_manage = true WHERE clinic_id = ${admin.clinicId} AND user_id = ${admin.userId}`), db);
    await expect(rows(db, admin, sql`UPDATE memberships SET can_manage = false WHERE clinic_id = ${desk.clinicId} AND user_id = ${desk.userId} RETURNING id`)).resolves.toHaveLength(1);
    // Desk is no longer a manager, so RLS filters the update out entirely (0 rows) — admin keeps access.
    expect(await rows(db, desk, sql`UPDATE memberships SET can_manage = false WHERE clinic_id = ${admin.clinicId} AND user_id = ${admin.userId} RETURNING id`)).toHaveLength(0);
  });
});
