import { appendFile, cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "@/lib/db/migrate";
import { readMigrationFiles } from "@/lib/db/migration-files";
import { withSystem } from "@/lib/db/system";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { loadPatientSnapshots } from "@/lib/services/snapshots";
import { createTestDatabase } from "../helpers/db";

const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const clinicA = uuid(1);
const clinicB = uuid(2);
const admin = { userId: uuid(11), clinicId: clinicA };
const physician = { userId: uuid(12), clinicId: clinicA };
const staff = { userId: uuid(13), clinicId: clinicA };
const disabled = { userId: uuid(14), clinicId: clinicA };
const otherAdmin = { userId: uuid(21), clinicId: clinicB };
const patientA = uuid(101);
const patientB = uuid(102);
const flagA = uuid(701);

const tenantTables = [
  "clinics", "memberships", "invitations", "patients", "encounters", "appointments",
  "symptom_observations", "lab_orders", "referrals", "tasks", "detection_runs",
  "detection_flags", "flag_events", "flag_feedback", "audit_logs",
] as const;

const clinicalTables = [
  "encounters", "symptom_observations", "lab_orders", "detection_flags",
  "flag_events", "flag_feedback", "detection_runs",
] as const;

async function rows<T>(tx: DbTransaction, query: SQL): Promise<T[]> {
  const result = await tx.execute(query);
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

async function count(tx: DbTransaction, table: string): Promise<number> {
  const result = await rows<{ count: number }>(tx, sql`select count(*)::int as count from ${sql.identifier(table)}`);
  return result[0].count;
}

async function rejectsWithSqlState(operation: Promise<unknown>, sqlState: string): Promise<void> {
  let error: unknown = await operation.then(() => null, (reason: unknown) => reason);
  const codes: string[] = [];
  while (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string") codes.push(error.code);
    error = "cause" in error ? error.cause : null;
  }
  expect(codes).toContain(sqlState);
}

describe("database isolation and authorization", () => {
  let db: DatabaseHandle;

  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec(`
      TRUNCATE users, clinics CASCADE;
      INSERT INTO users(id, email, display_name) VALUES
        ('${admin.userId}', 'admin-a@example.test', 'Admin A'),
        ('${physician.userId}', 'physician-a@example.test', 'Physician A'),
        ('${staff.userId}', 'staff-a@example.test', 'Staff A'),
        ('${disabled.userId}', 'disabled-a@example.test', 'Disabled A'),
        ('${otherAdmin.userId}', 'admin-b@example.test', 'Admin B');
      INSERT INTO clinics(id, name, slug) VALUES
        ('${clinicA}', 'Fixture A DEMO', 'fixture-a'),
        ('${clinicB}', 'Fixture B DEMO', 'fixture-b');
      INSERT INTO memberships(clinic_id, user_id, role, status) VALUES
        ('${clinicA}', '${admin.userId}', 'clinic_admin', 'active'),
        ('${clinicA}', '${physician.userId}', 'physician', 'active'),
        ('${clinicA}', '${staff.userId}', 'staff', 'active'),
        ('${clinicA}', '${disabled.userId}', 'physician', 'disabled'),
        ('${clinicB}', '${otherAdmin.userId}', 'clinic_admin', 'active');
      INSERT INTO invitations(clinic_id, email, role, token_hash, invited_by, expires_at) VALUES
        ('${clinicA}', 'invite-a@example.test', 'staff', 'token-a', '${admin.userId}', now() + interval '1 day'),
        ('${clinicB}', 'invite-b@example.test', 'staff', 'token-b', '${otherAdmin.userId}', now() + interval '1 day');
      INSERT INTO patients(id, clinic_id, demo_mrn, first_name, last_name, date_of_birth, sex, phone, primary_physician_id, seed_key) VALUES
        ('${patientA}', '${clinicA}', 'DEMO-00001', 'Fictional', 'Alpha', '1980-01-01', 'female', '555-0101', '${physician.userId}', 'fixture-a'),
        ('${patientB}', '${clinicB}', 'DEMO-00001', 'Fictional', 'Beta', '1980-01-01', 'male', '555-0102', NULL, 'fixture-b');
      INSERT INTO encounters(id, clinic_id, patient_id, occurred_at, encounter_type, chief_complaint, assessment, plan, seed_key) VALUES
        ('${uuid(201)}', '${clinicA}', '${patientA}', '2026-06-01T16:00:00Z', 'office_visit', 'CLINICAL_SECRET_A', 'ASSESSMENT_SECRET_A', 'PLAN_SECRET_A', 'encounter-a'),
        ('${uuid(202)}', '${clinicB}', '${patientB}', '2026-06-01T16:00:00Z', 'office_visit', 'CLINICAL_SECRET_B', 'ASSESSMENT_SECRET_B', 'PLAN_SECRET_B', 'encounter-b');
      INSERT INTO appointments(id, clinic_id, patient_id, scheduled_for, purpose, status, origin_encounter_id) VALUES
        ('${uuid(301)}', '${clinicA}', '${patientA}', '2026-06-10T16:00:00Z', 'follow_up', 'scheduled', '${uuid(201)}'),
        ('${uuid(302)}', '${clinicB}', '${patientB}', '2026-06-10T16:00:00Z', 'follow_up', 'scheduled', '${uuid(202)}');
      INSERT INTO symptom_observations(clinic_id, patient_id, encounter_id, symptom_code, label, observed_at, status) VALUES
        ('${clinicA}', '${patientA}', '${uuid(201)}', 'secret-symptom', 'SYMPTOM_SECRET_A', '2026-06-01T16:00:00Z', 'active'),
        ('${clinicB}', '${patientB}', '${uuid(202)}', 'secret-symptom', 'SYMPTOM_SECRET_B', '2026-06-01T16:00:00Z', 'active');
      INSERT INTO lab_orders(id, clinic_id, patient_id, encounter_id, test_name, ordered_at, expected_within_days, status) VALUES
        ('${uuid(401)}', '${clinicA}', '${patientA}', '${uuid(201)}', 'LAB_SECRET_A', '2026-06-01T16:00:00Z', 7, 'ordered'),
        ('${uuid(402)}', '${clinicB}', '${patientB}', '${uuid(202)}', 'LAB_SECRET_B', '2026-06-01T16:00:00Z', 7, 'ordered');
      INSERT INTO referrals(id, clinic_id, patient_id, encounter_id, specialty, reason, referred_at, expected_within_days, status, outcome_summary, symptom_code) VALUES
        ('${uuid(501)}', '${clinicA}', '${patientA}', '${uuid(201)}', 'Specialty A', 'REASON_SECRET_A', '2026-06-01T16:00:00Z', 30, 'sent', 'OUTCOME_SECRET_A', 'secret-symptom'),
        ('${uuid(502)}', '${clinicB}', '${patientB}', '${uuid(202)}', 'Specialty B', 'REASON_SECRET_B', '2026-06-01T16:00:00Z', 30, 'sent', 'OUTCOME_SECRET_B', 'secret-symptom');
      INSERT INTO tasks(id, clinic_id, patient_id, category, title, created_by) VALUES
        ('${uuid(601)}', '${clinicA}', '${patientA}', 'call_patient', 'Administrative task A', '${admin.userId}'),
        ('${uuid(602)}', '${clinicA}', '${patientA}', 'clinical_review', 'CLINICAL_TASK_SECRET_A', '${physician.userId}'),
        ('${uuid(603)}', '${clinicB}', '${patientB}', 'admin_other', 'Administrative task B', '${otherAdmin.userId}');
      INSERT INTO detection_runs(clinic_id, provider, rules_version, as_of, started_by, patients_evaluated, findings_count) VALUES
        ('${clinicA}', 'rules', '1.0.0', '2026-06-01T16:00:00Z', '${admin.userId}', 1, 1),
        ('${clinicB}', 'rules', '1.0.0', '2026-06-01T16:00:00Z', '${otherAdmin.userId}', 1, 1);
      INSERT INTO detection_flags(id, clinic_id, patient_id, rule_id, rule_version, fingerprint, subject_type, subject_id, title, rationale, evidence_hash) VALUES
        ('${flagA}', '${clinicA}', '${patientA}', 'lab-result-missing', '1.0.0', 'flag-a', 'lab_order', '${uuid(401)}', 'FLAG_SECRET_A', 'RATIONALE_SECRET_A', 'hash-a'),
        ('${uuid(702)}', '${clinicB}', '${patientB}', 'lab-result-missing', '1.0.0', 'flag-b', 'lab_order', '${uuid(402)}', 'FLAG_SECRET_B', 'RATIONALE_SECRET_B', 'hash-b');
      INSERT INTO flag_events(clinic_id, flag_id, event_type, actor_user_id, note) VALUES
        ('${clinicA}', '${flagA}', 'created', '${admin.userId}', 'EVENT_SECRET_A'),
        ('${clinicB}', '${uuid(702)}', 'created', '${otherAdmin.userId}', 'EVENT_SECRET_B');
      INSERT INTO flag_feedback(clinic_id, flag_id, user_id, verdict, comment) VALUES
        ('${clinicA}', '${flagA}', '${physician.userId}', 'accurate', 'FEEDBACK_SECRET_A');
      INSERT INTO audit_logs(clinic_id, actor_user_id, effective_user_id, action, entity_type, entity_id) VALUES
        ('${clinicA}', '${admin.userId}', '${physician.userId}', 'fixture.created', 'patient', '${patientA}'),
        ('${clinicB}', '${otherAdmin.userId}', '${otherAdmin.userId}', 'fixture.created', 'patient', '${patientB}');
    `);
  });

  it("applies migrations repeatedly without changing migration records or data", async () => {
    const before = await db.query("select * from schema_migrations");
    expect(before.length).toBeGreaterThanOrEqual(3);
    await migrate(db);
    await migrate(db);
    expect(await db.query("select * from schema_migrations")).toEqual(before);
    expect(await db.query("select count(*)::int as count from patients")).toEqual([{ count: 2 }]);
  });

  it("refuses a changed checksum for an already-applied migration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "symptomwatch-migrations-"));
    try {
      await cp(join(process.cwd(), "db/migrations"), directory, { recursive: true });
      const migration = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()[0];
      await appendFile(join(directory, migration), "\n-- changed after application\n");
      await expect(migrate(db, await readMigrationFiles(directory))).rejects.toThrow(/checksum/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("forces RLS on every tenant table with one permissive policy per command", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relname, relrowsecurity, relforcerowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'",
    );
    for (const name of tenantTables) {
      expect(tables.find((table) => table.relname === name)).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
    }
    const policies = await db.query<{ tablename: string; cmd: string; count: number }>(
      "select tablename, cmd, count(*)::int as count from pg_policies where schemaname = 'public' group by tablename, cmd",
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy.cmd).not.toBe("ALL");
      expect(policy.count, `${policy.tablename}: ${policy.cmd}`).toBe(1);
    }
    expect(await db.query("select rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname = 'sw_app'"))
      .toEqual([{ rolcanlogin: false, rolbypassrls: false, rolsuper: false }]);
  });

  it("isolates reads and rejects cross-clinic writes", async () => {
    await withTenant(admin, async (tx) => {
      expect(await rows(tx, sql`select id from patients`)).toEqual([{ id: patientA }]);
      expect(await rows(tx, sql`select id from clinics`)).toEqual([{ id: clinicA }]);
      expect(await rows(tx, sql`update appointments set status = 'confirmed' where id = ${uuid(302)} returning id`)).toEqual([]);
    }, db);
    await expect(withTenant(admin, (tx) => tx.execute(sql`
      insert into tasks(clinic_id, patient_id, category, title, created_by)
      values (${clinicB}, ${patientB}, 'admin_other', 'Wrong clinic', ${otherAdmin.userId})
    `), db)).rejects.toThrow();
    expect(await db.query("select status from appointments where id = $1", [uuid(302)])).toEqual([{ status: "scheduled" }]);
  });

  it("returns no rows for disabled membership, absent membership, or a forged role GUC", async () => {
    for (const context of [disabled, { userId: staff.userId, clinicId: clinicB }]) {
      await withTenant(context, async (tx) => {
        await tx.execute(sql`select set_config('app.role', 'clinic_admin', true)`);
        for (const table of tenantTables) expect(await count(tx, table), table).toBe(0);
        expect(await rows(tx, sql`select app.current_role() as role`)).toEqual([{ role: null }]);
      }, db);
    }
    await withTenant(staff, async (tx) => {
      await tx.execute(sql`select set_config('app.role', 'clinic_admin', true)`);
      expect(await rows(tx, sql`select app.current_role() as role`)).toEqual([{ role: "staff" }]);
      expect(await count(tx, "detection_flags")).toBe(0);
    }, db);
  });

  it("returns no tenant rows or service payload without GUC context", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role sw_app`);
      for (const table of tenantTables) expect(await count(tx, table), table).toBe(0);
      expect(await loadPatientSnapshots(tx)).toEqual([]);
    });
  });

  it("hides all clinical tables and clinical tasks from staff, including aggregate counts", async () => {
    await withTenant(staff, async (tx) => {
      for (const table of clinicalTables) {
        expect(await rows(tx, sql`select * from ${sql.identifier(table)}`), table).toEqual([]);
        expect(await count(tx, table), table).toBe(0);
      }
      expect(await rows(tx, sql`select title from tasks`)).toEqual([{ title: "Administrative task A" }]);
      expect(await count(tx, "tasks")).toBe(1);
    }, db);
  });

  it("redacts clinical fields and foreign keys from serialized staff service payloads", async () => {
    const snapshots = await withTenant(staff, (tx) => loadPatientSnapshots(tx), db);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ patientId: patientA, encounters: [], symptomObservations: [], labOrders: [] });
    expect(snapshots[0].appointments[0].originEncounterId).toBeNull();
    expect(snapshots[0].referrals[0]).toMatchObject({ encounterId: null, symptomCode: null });
    expect(JSON.stringify(snapshots)).not.toMatch(/SECRET|secret-symptom|chiefComplaint|assessment|outcomeSummary/);
  });

  it("lets staff manage administrative tasks but prevents creating or converting clinical tasks", async () => {
    await withTenant(staff, async (tx) => {
      expect(await rows(tx, sql`update tasks set status = 'in_progress' where id = ${uuid(601)} returning status`))
        .toEqual([{ status: "in_progress" }]);
      expect(await rows(tx, sql`update tasks set status = 'completed' where id = ${uuid(602)} returning id`)).toEqual([]);
    }, db);
    await expect(withTenant(staff, (tx) => tx.execute(sql`
      insert into tasks(clinic_id, patient_id, category, title, created_by)
      values (${clinicA}, ${patientA}, 'clinical_review', 'Forbidden review', ${staff.userId})
    `), db)).rejects.toThrow();
    await expect(withTenant(staff, (tx) => tx.execute(sql`update tasks set category = 'clinical_review' where id = ${uuid(601)}`), db)).rejects.toThrow();
    await expect(withTenant(admin, (tx) => tx.execute(sql`
      insert into tasks(clinic_id, patient_id, category, title, created_by)
      values (${clinicA}, ${patientA}, 'clinical_review', 'Forbidden admin review', ${admin.userId})
    `), db)).rejects.toThrow();
    await withTenant(physician, async (tx) => {
      expect(await rows(tx, sql`update tasks set status = 'in_progress' where id = ${uuid(602)} returning id`))
        .toEqual([{ id: uuid(602) }]);
    }, db);
  });

  it("allows administrators to run detection while denying staff", async () => {
    await withTenant(admin, async (tx) => {
      await tx.execute(sql`
        insert into detection_runs(clinic_id, provider, rules_version, as_of, started_by, patients_evaluated, findings_count)
        values (${clinicA}, 'rules', '1.0.1', now(), ${admin.userId}, 1, 1)
      `);
      await tx.execute(sql`update detection_flags set evidence_hash = 'new-hash', status = 'resolved_by_data' where id = ${flagA}`);
      await tx.execute(sql`insert into flag_events(clinic_id, flag_id, event_type, actor_user_id) values (${clinicA}, ${flagA}, 'resolved_by_data', ${admin.userId})`);
    }, db);
    await expect(withTenant(staff, (tx) => tx.execute(sql`
      insert into detection_runs(clinic_id, provider, rules_version, as_of, started_by, patients_evaluated, findings_count)
      values (${clinicA}, 'rules', '1.0.1', now(), ${staff.userId}, 1, 1)
    `), db)).rejects.toThrow();
  });

  it.each(["confirmed", "dismissed"])("denies administrator flag status %s, including insert bypasses", async (status) => {
    await expect(withTenant(admin, (tx) => tx.execute(sql`
      update detection_flags set status = ${status} where id = ${flagA}
    `), db)).rejects.toThrow();
    await expect(withTenant(admin, (tx) => tx.execute(sql`
      insert into detection_flags(clinic_id, patient_id, rule_id, rule_version, fingerprint, subject_type, subject_id, title, rationale, evidence_hash, status)
      values (${clinicA}, ${patientA}, 'lab-result-missing', '1.0.0', 'review-bypass', 'lab_order', ${uuid(401)}, 'Question', 'Reason', 'hash', ${status})
    `), db)).rejects.toThrow();
  });

  it("denies administrators every flag review column and feedback", async () => {
    for (const query of [
      sql`update detection_flags set reviewed_by = ${admin.userId} where id = ${flagA}`,
      sql`update detection_flags set reviewed_at = now() where id = ${flagA}`,
      sql`update detection_flags set review_note = 'Review denied' where id = ${flagA}`,
      sql`insert into flag_feedback(clinic_id, flag_id, user_id, verdict) values (${clinicA}, ${flagA}, ${admin.userId}, 'accurate')`,
    ]) {
      await expect(withTenant(admin, (tx) => tx.execute(query), db)).rejects.toThrow();
    }
    for (const event of ["confirmed", "dismissed", "feedback"]) {
      await expect(withTenant(admin, (tx) => tx.execute(sql`
        insert into flag_events(clinic_id, flag_id, event_type, actor_user_id)
        values (${clinicA}, ${flagA}, ${event}, ${admin.userId})
      `), db)).rejects.toThrow();
    }
  });

  it("allows physician reviews and detection updates without altering existing review metadata", async () => {
    await withTenant(physician, async (tx) => {
      await tx.execute(sql`update detection_flags set status = 'confirmed', reviewed_by = ${physician.userId}, reviewed_at = now(), review_note = 'Physician review' where id = ${flagA}`);
      await tx.execute(sql`insert into flag_feedback(clinic_id, flag_id, user_id, verdict) values (${clinicA}, ${flagA}, ${physician.userId}, 'already_addressed')`);
      await tx.execute(sql`insert into flag_events(clinic_id, flag_id, event_type, actor_user_id) values (${clinicA}, ${flagA}, 'confirmed', ${physician.userId})`);
    }, db);
    await withTenant(admin, async (tx) => {
      await tx.execute(sql`update detection_flags set evidence_hash = 'fresh-evidence', last_detected_at = now() where id = ${flagA}`);
      expect(await rows(tx, sql`select status, reviewed_by, review_note from detection_flags where id = ${flagA}`))
        .toEqual([{ status: "confirmed", reviewed_by: physician.userId, review_note: "Physician review" }]);
    }, db);
  });

  it("restricts memberships and invitations writes to administrators", async () => {
    for (const context of [physician, staff]) {
      await withTenant(context, async (tx) => {
        expect(await rows(tx, sql`update memberships set role = 'clinic_admin' where user_id = ${context.userId} returning id`)).toEqual([]);
        expect(await rows(tx, sql`update invitations set revoked_at = now() returning id`)).toEqual([]);
      }, db);
      await expect(withTenant(context, (tx) => tx.execute(sql`
        insert into invitations(clinic_id, email, role, token_hash, invited_by, expires_at)
        values (${clinicA}, 'unauthorized@example.test', 'staff', 'forbidden-token', ${context.userId}, now() + interval '1 day')
      `), db)).rejects.toThrow();
    }
    await withTenant(admin, async (tx) => {
      expect(await rows(tx, sql`update invitations set revoked_at = now() returning clinic_id`)).toEqual([{ clinic_id: clinicA }]);
    }, db);
  });

  it("permits physician lab updates and active-member appointment/referral administrative updates", async () => {
    await withTenant(admin, async (tx) => {
      expect(await rows(tx, sql`update lab_orders set status = 'collected' returning id`)).toEqual([]);
    }, db);
    await withTenant(physician, async (tx) => {
      expect(await rows(tx, sql`update lab_orders set status = 'collected' where id = ${uuid(401)} returning status`)).toEqual([{ status: "collected" }]);
    }, db);
    for (const context of [staff, admin, physician]) {
      await withTenant(context, async (tx) => {
        expect(await rows(tx, sql`update appointments set status = 'confirmed' where id = ${uuid(301)} returning id`)).toEqual([{ id: uuid(301) }]);
        expect(await rows(tx, sql`update referrals set status = 'scheduled' where id = ${uuid(501)} returning id`)).toEqual([{ id: uuid(501) }]);
      }, db);
    }
  });

  it("restricts audit reads to administrators and accepts audit inserts from every active member", async () => {
    for (const context of [admin, physician, staff]) {
      await withTenant(context, async (tx) => {
        expect(await count(tx, "audit_logs")).toBe(context === admin ? 1 : 0);
        await tx.execute(sql`insert into audit_logs(clinic_id, actor_user_id, action, entity_type) values (${clinicA}, ${context.userId}, 'fixture.action', 'test')`);
      }, db);
    }
    await expect(withTenant(disabled, (tx) => tx.execute(sql`
      insert into audit_logs(clinic_id, actor_user_id, action, entity_type)
      values (${clinicA}, ${disabled.userId}, 'forbidden.action', 'test')
    `), db)).rejects.toThrow();
    await rejectsWithSqlState(withTenant(admin, (tx) => tx.execute(sql`
      insert into audit_logs(clinic_id, actor_user_id, action, entity_type)
      values (NULL, ${admin.userId}, 'forbidden.tenantless', 'test')
    `), db), "42501");
  });

  it.each(["audit_logs", "flag_events"])("makes %s append-only for the app role", async (table) => {
    await expect(withTenant(physician, (tx) => tx.execute(sql`delete from ${sql.identifier(table)}`), db)).rejects.toThrow();
    const field = table === "audit_logs" ? "action" : "note";
    await expect(withTenant(admin, (tx) => tx.execute(sql`update ${sql.identifier(table)} set ${sql.identifier(field)} = 'tampered'`), db)).rejects.toThrow();
  });

  it("prevents cross-tenant patient, encounter, flag, and assignee references", async () => {
    for (const query of [
      sql`insert into appointments(clinic_id, patient_id, scheduled_for, purpose, status) values (${clinicA}, ${patientB}, now(), 'follow_up', 'scheduled')`,
      sql`insert into appointments(clinic_id, patient_id, scheduled_for, purpose, status, origin_encounter_id) values (${clinicA}, ${patientA}, now(), 'follow_up', 'scheduled', ${uuid(202)})`,
      sql`insert into tasks(clinic_id, patient_id, category, title, created_by, assignee_id) values (${clinicA}, ${patientA}, 'admin_other', 'Wrong assignee', ${admin.userId}, ${otherAdmin.userId})`,
      sql`insert into tasks(clinic_id, patient_id, category, title, created_by, source_flag_id) values (${clinicA}, ${patientA}, 'admin_other', 'Wrong flag', ${admin.userId}, ${uuid(702)})`,
    ]) {
      await rejectsWithSqlState(withTenant(admin, (tx) => tx.execute(query), db), "23503");
    }
  });

  it("enforces synthetic-only patients, fictional phone numbers, and demo MRNs", async () => {
    for (const change of [
      "is_synthetic = false", "phone = '949-123-4567'", "phone = '555-0200'", "demo_mrn = 'REAL-12345'",
    ]) {
      await rejectsWithSqlState(db.query(`update patients set ${change} where id = $1`, [patientA]), "23514");
    }
  });

  it("clears role and GUC context after both commit and rollback", async () => {
    for (const rollback of [false, true]) {
      const operation = withTenant(admin, async (tx) => {
        expect(await count(tx, "patients")).toBe(1);
        if (rollback) throw new Error("Deliberate rollback");
      }, db);
      if (rollback) await expect(operation).rejects.toThrow("Deliberate rollback");
      else await operation;
      await withSystem(async (tx) => {
        expect(await count(tx, "patients")).toBe(2);
        const context = await rows(tx, sql`select current_user as role, nullif(current_setting('app.user_id', true), '') as user_id, nullif(current_setting('app.clinic_id', true), '') as clinic_id`);
        expect(context).toEqual([{ role: expect.not.stringMatching(/^sw_app$/), user_id: null, clinic_id: null }]);
      }, db);
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local role sw_app`);
        expect(await count(tx, "patients")).toBe(0);
      });
    }
  });

  it("serializes interleaved tenant and system calls on the shared handle", async () => {
    const operations = Array.from({ length: 12 }, (_, index) => {
      if (index % 3 === 2) return withSystem(async (tx) => {
        expect(await count(tx, "patients")).toBe(2);
        await Promise.resolve();
        expect(await rows(tx, sql`select app.current_clinic_id() as id`)).toEqual([{ id: null }]);
      }, db);
      const context = index % 3 === 0 ? admin : otherAdmin;
      return withTenant(context, async (tx) => {
        expect(await rows(tx, sql`select clinic_id from patients`)).toEqual([{ clinic_id: context.clinicId }]);
        await Promise.resolve();
        expect(await rows(tx, sql`select app.current_clinic_id() as id`)).toEqual([{ id: context.clinicId }]);
      }, db);
    });
    await Promise.all(operations);
  });
});
