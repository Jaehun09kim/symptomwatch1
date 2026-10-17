import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { auditLogs } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import { listAuditLog } from "@/lib/services/audit";
import { getDashboardSummary, startOfWeekUtc } from "@/lib/services/dashboard";
import { getPatientRecord, listPatients } from "@/lib/services/patients";
import { updateReferral } from "@/lib/services/records";
import { changeMemberRole, setMemberStatus } from "@/lib/services/staff";
import { createTask, listTasks, updateTask } from "@/lib/services/tasks";
import { contextFor, createSeededDatabase, patientId } from "../helpers/seeded";

describe("tenant services", () => {
  let db: DatabaseHandle;
  let physician: AppContext;
  let staff: AppContext;
  let admin: AppContext;
  let otherClinicPhysician: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    physician = await contextFor(db, "hv-dr-rivera");
    staff = await contextFor(db, "hv-fd-okafor");
    admin = await contextFor(db, "hv-admin-shah");
    otherClinicPhysician = await contextFor(db, "og-dr-brooks");
  });
  afterAll(async () => { await db.close(); });

  describe("patients", () => {
    it("lists only the caller's clinic and supports search, filters, and paging", async () => {
      const all = await listPatients(physician, {}, db);
      expect(all.total).toBe(30);
      expect(all.rows).toHaveLength(12);
      const search = await listPatients(physician, { q: "vasquez" }, db);
      expect(search.rows.map((row) => row.lastName)).toEqual(["Vasquez"]);
      const byMrn = await listPatients(physician, { q: "DEMO-00001" }, db);
      expect(byMrn.total).toBe(1);
      const other = await listPatients(otherClinicPhysician, {}, db);
      expect(other.total).toBe(6);
      const withTasks = await listPatients(physician, { status: "open_tasks", sort: "open_tasks" }, db);
      expect(withTasks.rows.every((row) => row.openTasks > 0)).toBe(true);
    });

    it("never gives front-desk staff flag counts or clinical-review task counts", async () => {
      const staffRows = (await listPatients(staff, { q: "Morgan" }, db)).rows;
      const physicianRows = (await listPatients(physician, { q: "Morgan" }, db)).rows;
      expect(staffRows[0].openFlags).toBeNull();
      // hv-11 has one clinical_review task that staff must not see counted.
      expect(physicianRows[0].openTasks - staffRows[0].openTasks).toBe(1);
    });

    it("redacts clinical records and referral reasons for front-desk staff", async () => {
      const id = await patientId(db, "hv-08");
      const staffView = await getPatientRecord(staff, id, {}, db);
      expect(staffView.clinical).toBe(false);
      expect(staffView.encounters).toEqual([]);
      expect(staffView.labs).toEqual([]);
      expect(staffView.referrals[0]).toMatchObject({ specialty: "Gastroenterology", reason: null, outcomeSummary: null });
      const serialized = JSON.stringify(staffView);
      expect(serialized).not.toContain("bowel");

      const physicianView = await getPatientRecord(physician, id, {}, db);
      expect(physicianView.encounters).toHaveLength(1);
      expect(physicianView.referrals[0].reason).toMatch(/bowel/);
    });

    it("refuses cross-clinic patient access", async () => {
      const id = await patientId(db, "og-01");
      await expect(getPatientRecord(physician, id, {}, db)).rejects.toThrow("Patient not found.");
    });

    it("audits timeline views once per 10 minutes per user and patient", async () => {
      const id = await patientId(db, "hv-02");
      await getPatientRecord(physician, id, { audit: true }, db);
      await getPatientRecord(physician, id, { audit: true }, db);
      const rows = await withSystem((tx) => tx.select().from(auditLogs).where(eq(auditLogs.entityId, id)), db);
      expect(rows.filter((row) => row.action === "patient.timeline_viewed")).toHaveLength(1);
    });
  });

  describe("tasks", () => {
    it("creates, assigns, and completes a task with an outcome, auditing each step", async () => {
      const patient = await patientId(db, "hv-01");
      const taskId = await createTask(staff, { title: "Call to reschedule", category: "call_patient", patientId: patient, assigneeId: staff.userId, dueDate: "2030-01-01" }, db);
      await updateTask(staff, { taskId, status: "in_progress" }, db);
      await expect(updateTask(staff, { taskId, status: "completed" }, db)).rejects.toThrow(/Record an outcome/);
      await updateTask(staff, { taskId, status: "completed", outcome: "Rescheduled for next week (simulated)." }, db);
      const [task] = (await listTasks(staff, { status: "any", patientId: patient }, db)).filter((row) => row.id === taskId);
      expect(task).toMatchObject({ status: "completed", outcome: "Rescheduled for next week (simulated)." });
      expect(task.completedAt).not.toBeNull();
      const actions = (await withSystem((tx) => tx.select().from(auditLogs).where(eq(auditLogs.entityId, taskId)), db)).map((row) => row.action);
      expect(actions).toEqual(expect.arrayContaining(["task.created", "task.status_changed"]));
    });

    it("keeps clinical review tasks physician-only", async () => {
      await expect(createTask(staff, { title: "Review results", category: "clinical_review", dueDate: "2030-01-01" }, db)).rejects.toThrow(/Only physicians/);
      await expect(createTask(physician, { title: "Review results", category: "clinical_review", assigneeId: staff.userId, dueDate: "2030-01-01" }, db))
        .rejects.toThrow(/can't be assigned/);
      const id = await createTask(physician, { title: "Review results", category: "clinical_review", assigneeId: physician.userId, dueDate: "2030-01-01" }, db);
      expect((await listTasks(staff, { view: "clinical" }, db)).find((row) => row.id === id)).toBeUndefined();
    });

    it("rejects assignees from another clinic and text that looks like PHI", async () => {
      await expect(createTask(staff, { title: "Call", category: "call_patient", assigneeId: otherClinicPhysician.userId, dueDate: "2030-01-01" }, db))
        .rejects.toThrow(/can't be assigned/);
      await expect(createTask(staff, { title: "Call patient at (714) 832-4471", category: "call_patient", dueDate: "2030-01-01" }, db))
        .rejects.toThrow(/fictional data only/);
    });

    it("filters the queue by view, assignee, and due window", async () => {
      const records = await listTasks(staff, { view: "records" }, db);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((row) => row.category === "request_records" && row.status !== "completed")).toBe(true);
      const mine = await listTasks(staff, { assignee: "me" }, db);
      expect(mine.every((row) => row.assigneeId === staff.userId)).toBe(true);
      const overdue = await listTasks(staff, { due: "overdue" }, db);
      expect(overdue.every((row) => new Date(row.dueDate) < new Date())).toBe(true);
    });
  });

  describe("records and dashboard", () => {
    it("lets front-desk staff record specialist records received", async () => {
      const record = await getPatientRecord(staff, await patientId(db, "hv-20"), {}, db);
      await updateReferral(staff, { referralId: record.referrals[0].id, status: "records_received", date: new Date().toISOString().slice(0, 10) }, db);
      const after = await getPatientRecord(staff, record.header.id, {}, db);
      expect(after.referrals[0].status).toBe("records_received");
    });

    it("computes role-appropriate dashboard metrics", async () => {
      const forPhysician = await getDashboardSummary(physician, new Date(), db);
      const forStaff = await getDashboardSummary(staff, new Date(), db);
      expect(forPhysician.totalPatients).toBe(30);
      expect(forPhysician.pendingLabs).toBeGreaterThan(0);
      expect(forStaff.pendingLabs).toBeNull();
      expect(forStaff.patientsNeedingReview).toBeNull();
      expect(forPhysician.weekly).toHaveLength(8);
      expect(forPhysician.weekly.reduce((sum, week) => sum + week.completed, 0)).toBeGreaterThan(0);
    });

    it("starts weeks on Monday (UTC)", () => {
      expect(startOfWeekUtc(new Date("2026-10-18T10:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
      expect(startOfWeekUtc(new Date("2026-10-12T00:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    });
  });

  describe("staff administration", () => {
    it("protects the last clinic administrator", async () => {
      await expect(changeMemberRole(admin, { userId: admin.userId, role: "physician" }, db)).rejects.toThrow(/at least one active administrator/);
      await expect(setMemberStatus(admin, { userId: admin.userId, status: "disabled" }, db)).rejects.toThrow(/own access/);
    });

    it("restricts staff administration and audit reading to admins", async () => {
      await expect(changeMemberRole(physician, { userId: staff.userId, role: "physician" }, db)).rejects.toThrow(/Only clinic administrators/);
      await expect(listAuditLog(physician, {}, db)).rejects.toThrow(/Only clinic administrators/);
      const log = await listAuditLog(admin, {}, db);
      expect(log.total).toBeGreaterThan(0);
      expect(log.entries[0].actorName).toBeTruthy();
    });
  });
});
