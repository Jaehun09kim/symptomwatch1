import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppContext } from "@/lib/authz/context";
import { appointments, detectionFlags, flagEvents, referrals, tasks } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import type { DatabaseHandle } from "@/lib/db/types";
import {
  addFlagFeedback,
  confirmFlag,
  dismissFlag,
  feedbackSummary,
  getFlagHistory,
  listFlags,
  runDetectionForClinic,
} from "@/lib/services/detection";
import { getPatientRecord } from "@/lib/services/patients";
import { updateReferral } from "@/lib/services/records";
import { contextFor, createSeededDatabase, patientId } from "../helpers/seeded";

async function flagFor(db: DatabaseHandle, ctx: AppContext, patientKey: string, ruleId: string) {
  const id = await patientId(db, patientKey);
  return (await listFlags(ctx, { status: "all" }, db)).find((flag) => flag.patientId === id && flag.ruleId === ruleId);
}

describe("stored detection and review workflow", () => {
  let db: DatabaseHandle;
  let physician: AppContext;
  let admin: AppContext;
  let staff: AppContext;

  beforeAll(async () => {
    db = await createSeededDatabase();
    physician = await contextFor(db, "hv-dr-rivera");
    admin = await contextFor(db, "hv-admin-shah");
    staff = await contextFor(db, "hv-fd-okafor");
  });
  afterAll(async () => { await db.close(); });

  it("seeds clinics with open flags that clinical roles can read and staff cannot", async () => {
    const open = await listFlags(physician, {}, db);
    expect(open.length).toBeGreaterThan(5);
    expect(open.every((flag) => flag.status === "open")).toBe(true);
    await expect(listFlags(staff, {}, db)).rejects.toThrow(/don't have access/);
    const otherClinic = await listFlags(await contextFor(db, "og-dr-brooks"), {}, db);
    expect(new Set(otherClinic.map((flag) => flag.patientId)).size).toBeGreaterThan(0);
    expect(otherClinic.some((flag) => open.some((mine) => mine.id === flag.id))).toBe(false);
  });

  it("is idempotent: re-running without data changes creates nothing new", async () => {
    const before = await listFlags(physician, { status: "all" }, db);
    const summary = await runDetectionForClinic(admin, db);
    expect(summary).toMatchObject({ created: 0, reopened: 0, resolved: 0, patientsEvaluated: 30 });
    expect((await listFlags(physician, { status: "all" }, db)).length).toBe(before.length);
  });

  it("lets only physicians review; admins may run detection but not confirm", async () => {
    const flag = (await flagFor(db, physician, "hv-02", "lab-result-missing"))!;
    await expect(confirmFlag(admin, { flagId: flag.id }, db)).rejects.toThrow(/Only physicians/);
    await expect(confirmFlag(staff, { flagId: flag.id }, db)).rejects.toThrow(/Only physicians/);
  });

  it("confirms a gap and creates exactly one follow-up task, atomically", async () => {
    const flag = (await flagFor(db, physician, "hv-02", "lab-result-missing"))!;
    await confirmFlag(physician, { flagId: flag.id, note: "Lab draw not completed", createTask: true, taskCategory: "lab_follow_up", assigneeId: staff.userId }, db);
    await confirmFlag(physician, { flagId: flag.id, createTask: true }, db);
    const linked = await withSystem((tx) => tx.select().from(tasks).where(eq(tasks.sourceFlagId, flag.id)), db);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({ category: "lab_follow_up", assigneeId: staff.userId });
    const updated = (await flagFor(db, physician, "hv-02", "lab-result-missing"))!;
    expect(updated).toMatchObject({ status: "confirmed", reviewNote: "Lab draw not completed" });
    expect(updated.reviewerName).toBe("Dr. Maya Rivera");
  });

  it("keeps a dismissed flag dismissed on re-runs, and reopens it when its evidence changes", async () => {
    const flag = (await flagFor(db, physician, "hv-01", "overdue-follow-up"))!;
    await expect(dismissFlag(physician, { flagId: flag.id, reason: "" }, db)).rejects.toThrow();
    await dismissFlag(physician, { flagId: flag.id, reason: "Patient follows with an outside cardiologist" }, db);
    await runDetectionForClinic(physician, db);
    expect((await flagFor(db, physician, "hv-01", "overdue-follow-up"))!.status).toBe("dismissed");

    // New documentation (another missed follow-up) changes the evidence set.
    await withSystem(async (tx) => {
      const [original] = await tx.select().from(appointments).where(eq(appointments.patientId, flag.patientId));
      await tx.insert(appointments).values({ clinicId: original.clinicId, patientId: flag.patientId, scheduledFor: new Date(Date.now() - 5 * 86_400_000).toISOString(), purpose: "follow_up", status: "no_show" });
    }, db);
    await runDetectionForClinic(physician, db);
    const reopened = (await flagFor(db, physician, "hv-01", "overdue-follow-up"))!;
    expect(reopened.status).toBe("open");
    const history = (await getFlagHistory(physician, [flag.id], db))[flag.id].map((entry) => entry.eventType);
    expect(history).toEqual(["created", "dismissed", "reopened_evidence_changed"]);
  });

  it("resolves a flag when front-desk staff record the missing documentation, without exposing flags to staff", async () => {
    const flag = (await flagFor(db, physician, "hv-08", "referral-outcome-missing"))!;
    expect(flag.status).toBe("open");
    const record = await getPatientRecord(staff, flag.patientId, {}, db);
    await updateReferral(staff, { referralId: record.referrals[0].id, status: "records_received", date: new Date().toISOString().slice(0, 10) }, db);
    const resolved = (await flagFor(db, physician, "hv-08", "referral-outcome-missing"))!;
    expect(resolved.status).toBe("resolved_by_data");
    const [event] = await withSystem((tx) => tx.select().from(flagEvents).where(and(eq(flagEvents.flagId, flag.id), eq(flagEvents.eventType, "resolved_by_data"))), db);
    expect(event.actorUserId).toBe(staff.userId);

    // If the documentation is reverted, the gap reopens.
    await withSystem((tx) => tx.update(referrals).set({ status: "scheduled", recordsReceivedAt: null }).where(eq(referrals.id, record.referrals[0].id)), db);
    await runDetectionForClinic(physician, db);
    expect((await flagFor(db, physician, "hv-08", "referral-outcome-missing"))!.status).toBe("open");
  });

  it("records clinician feedback and aggregates it per rule", async () => {
    const flag = (await flagFor(db, physician, "hv-03", "referral-outcome-missing"))!;
    await addFlagFeedback(physician, { flagId: flag.id, verdict: "accurate", comment: "Helpful catch" }, db);
    await expect(addFlagFeedback(admin, { flagId: flag.id, verdict: "not_useful" }, db)).rejects.toThrow(/Only physicians/);
    const summary = await feedbackSummary(physician, db);
    expect(summary).toContainEqual({ ruleId: "referral-outcome-missing", verdict: "accurate", count: 1 });
  });

  it("never flags the care-transferred patient", async () => {
    const id = await patientId(db, "hv-14");
    const rows = await withSystem((tx) => tx.select().from(detectionFlags).where(eq(detectionFlags.patientId, id)), db);
    expect(rows).toEqual([]);
  });
});
