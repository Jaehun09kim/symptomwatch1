import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import type { DatabaseHandle } from "@/lib/db/types";
import { flagTaskDefaults } from "@/lib/flag-task-defaults";
import { parseQueueFilters, queueQuickViewParams } from "@/lib/queue-filters";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { confirmFlag, listFlags, snoozeFlag } from "@/lib/services/detection";
import { listPatients } from "@/lib/services/patients";
import { createTask, listTasks, updateTask } from "@/lib/services/tasks";
import { contextFor, createSeededDatabase } from "../helpers/seeded";

describe("app workflow boundaries and destinations", () => {
  let db: DatabaseHandle;
  let physician: AppContext;
  let staff: AppContext;
  let other: AppContext;
  beforeAll(async () => {
    db = await createSeededDatabase();
    physician = await contextFor(db, "hv-dr-rivera");
    staff = await contextFor(db, "hv-fd-okafor");
    other = await contextFor(db, "og-dr-brooks");
  });
  afterAll(async () => { await db.close(); });

  it("headline metrics match destination queries, including snooze exclusion", async () => {
    const flag = (await listFlags(physician, { ruleId: "lab-result-missing" }, db))[0];
    await snoozeFlag(physician, { flagId: flag.id, until: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) }, db);
    for (const ctx of [physician, staff]) {
      const summary = await getDashboardSummary(ctx, new Date(), db);
      expect(summary.overdueAdminTasks).toBe((await listTasks(ctx, { view: "admin", due: "overdue" }, db)).length);
      expect(summary.openRecordTasks).toBe((await listTasks(ctx, { view: "records" }, db)).length);
      expect(summary.openTasks).toBe((await listTasks(ctx, {}, db)).length);
      if (ctx === physician) {
        expect(summary.pendingLabFlags).toBe((await listFlags(ctx, { ruleId: "lab-result-missing" }, db)).length);
        expect(summary.patientsNeedingReview).toBe((await listPatients(ctx, { status: "awaiting_review" }, db)).total);
      } else {
        expect(summary.pendingLabFlags).toBeNull();
        expect(summary.patientsNeedingReview).toBeNull();
        expect(summary.openFlagsByRule).toBeNull();
      }
    }
  });

  it("derives each default from the stored rule and signed-in physician", async () => {
    for (const ruleId of ["lab-result-missing", "referral-outcome-missing", "overdue-follow-up", "persistent-symptom-unresolved"] as const) {
      const flag = (await listFlags(physician, { ruleId }, db))[0];
      await confirmFlag(physician, { flagId: flag.id, createTask: true }, db);
      const task = (await listTasks(physician, {}, db)).find((row) => row.sourceFlagId === flag.id)!;
      const expected = flagTaskDefaults(ruleId, flag.title, physician.userId);
      expect(task).toMatchObject({ category: expected.category, title: expected.title, assigneeId: physician.userId });
      expect(task.dueDate.slice(0, 10)).toBe(expected.dueDate);
      if (ruleId === "persistent-symptom-unresolved") {
        expect(await listTasks(staff, { taskId: task.id }, db)).toEqual([]);
        await expect(updateTask(staff, { taskId: task.id, outcomeChoice: "plan_documented" }, db)).rejects.toThrow();
      }
    }
  });

  it("preserves explicit Unassigned and rejects staff ownership of a clinical task atomically", async () => {
    const flag = (await listFlags(physician, { ruleId: "persistent-symptom-unresolved" }, db))[0];
    await expect(confirmFlag(physician, { flagId: flag.id, createTask: true, assigneeId: staff.userId }, db)).rejects.toThrow(/can't be assigned/);
    expect((await listFlags(physician, {}, db)).some((row) => row.id === flag.id)).toBe(true);
    await expect(confirmFlag(other, { flagId: flag.id, createTask: true }, db)).rejects.toThrow(/not found/);
    await expect(confirmFlag(staff, { flagId: flag.id, createTask: true }, db)).rejects.toThrow(/Only physicians/);
    await confirmFlag(physician, { flagId: flag.id, createTask: true, assigneeId: "" }, db);
    expect((await listTasks(physician, {}, db)).find((row) => row.sourceFlagId === flag.id)?.assigneeId).toBeNull();
  });

  it("quick views filter persisted work and manual outcomes preserve open work", async () => {
    const dueDate = new Date().toISOString().slice(0, 10);
    const taskId = await createTask(staff, { title: "Book fictional follow-up", category: "call_patient", dueDate, assigneeId: staff.userId }, db);
    const mine = parseQueueFilters(Object.fromEntries(queueQuickViewParams("mine")), false);
    expect((await listTasks(staff, mine, db)).every((row) => row.assigneeId === staff.userId)).toBe(true);
    const today = parseQueueFilters(Object.fromEntries(queueQuickViewParams("today")), false);
    expect((await listTasks(staff, today, db)).map((row) => row.id)).toContain(taskId);
    const overdue = parseQueueFilters(Object.fromEntries(queueQuickViewParams("overdue")), false);
    expect((await listTasks(staff, overdue, db)).every((row) => row.dueDate.slice(0, 10) < dueDate)).toBe(true);
    const unassigned = parseQueueFilters(Object.fromEntries(queueQuickViewParams("unassigned")), false);
    expect((await listTasks(staff, unassigned, db)).every((row) => row.assigneeId === null)).toBe(true);
    await updateTask(staff, { taskId, outcomeChoice: "attempted", outcomeNote: "Try again tomorrow" }, db);
    expect((await listTasks(staff, { taskId }, db))[0]).toMatchObject({ status: "in_progress", outcome: "Attempted; try again — Try again tomorrow" });
    await expect(updateTask(staff, { taskId, outcomeChoice: "plan_documented" }, db)).rejects.toThrow(/Choose an outcome/);
    await expect(updateTask(other, { taskId, outcomeChoice: "rebooked" }, db)).rejects.toThrow(/not found/);
    await updateTask(staff, { taskId, outcomeChoice: "rebooked" }, db);
    expect(await listTasks(staff, { taskId }, db)).toEqual([]);
    expect((await listTasks(staff, { taskId, status: "completed" }, db))[0]).toMatchObject({ status: "completed", outcome: "Follow-up booked" });
  });
});
