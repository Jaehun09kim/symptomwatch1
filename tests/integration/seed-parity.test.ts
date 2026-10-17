import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { patients as exportedPatients, type SyntheticPatient, type SyntheticTask } from "@/data/synthetic";
import {
  appointments,
  auditLogs,
  detectionFlags,
  detectionRuns,
  encounters,
  flagEvents,
  flagFeedback,
  labOrders,
  memberships,
  patients,
  referrals,
  symptomObservations,
  tasks,
  users,
} from "@/lib/db/schema";
import { withSystem } from "@/lib/db/system";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { dateAtOffset } from "@/lib/demo/dates";
import { buildSnapshotsFromSynthetic } from "@/lib/detection/snapshot-from-synthetic";
import type { PatientSnapshot } from "@/lib/detection/types";
import { resetEnvForTests } from "@/lib/env";
import {
  resetClinicDemoData,
  seedSharedDemo,
  seedSyntheticClinic,
  type SyntheticSeedData,
} from "@/lib/services/demo-seed";
import { loadPatientSnapshots } from "@/lib/services/snapshots";
import { createTestDatabase } from "../helpers/db";

const referenceDate = "2026-06-01";
const fixturePatients: SyntheticPatient[] = [
  {
    key: "fixture-b", clinic: "harbor-view", tags: [], narrative: "Fictional complete timeline",
    firstName: "Jamie", lastName: "Example", dateOfBirth: "1983-02-14", sex: "female",
    phone: "555-0101", primaryPhysician: "hv-dr-rivera", careStatus: "active",
    encounters: [
      {
        key: "visit-z", day: -12, type: "telehealth", status: "cancelled", provider: "hv-dr-rivera",
        chiefComplaint: "Fictional symptom", assessment: "Fictional assessment", plan: "Fictional plan",
        followUp: { kind: "as_needed" },
        symptoms: [{ code: "fatigue", label: "Fictional fatigue", status: "improving", note: "Fictional note" }],
      },
      {
        key: "visit-a", day: -90, type: "office_visit", provider: "hv-dr-nguyen",
        chiefComplaint: "Fictional fatigue", assessment: "Fictional assessment", plan: "Return visit documented",
        followUp: { kind: "interval", intervalDays: 30 },
        symptoms: [
          { code: "fatigue", label: "Fictional fatigue", status: "active" },
          { code: "cough", label: "Fictional cough", status: "resolved" },
        ],
      },
    ],
    appointments: [
      { key: "appt-b", day: 6, purpose: "follow_up", status: "confirmed", originEncounter: "visit-a" },
      { key: "appt-a", day: -30, purpose: "lab_draw", status: "no_show", statusReason: "Fictional scheduling issue" },
    ],
    labs: [
      { key: "lab-b", encounter: "visit-a", day: -88, testName: "Fictional blood count", expectedWithinDays: 10,
        status: "resulted", collectedDay: -85, resultedDay: -80, resultSummary: "Fictional result", symptomCode: "fatigue" },
      { key: "lab-a", day: 0, testName: "Fictional panel", expectedWithinDays: 7, status: "ordered" },
    ],
    referrals: [
      { key: "ref-b", encounter: "visit-a", day: -45, specialty: "Fictional specialist", reason: "Sensitive fictional reason",
        expectedWithinDays: 21, status: "scheduled", specialistAppointmentDay: 0, symptomCode: "fatigue" },
      { key: "ref-a", day: -70, specialty: "Fictional specialty", reason: "Sensitive fictional reason",
        expectedWithinDays: 28, status: "records_received", specialistAppointmentDay: -40, recordsReceivedDay: -30,
        outcomeSummary: "Sensitive fictional outcome" },
    ],
  },
  {
    key: "fixture-a", clinic: "harbor-view", tags: [], narrative: "Fictional empty timeline",
    firstName: "Casey", lastName: "Example", dateOfBirth: "1972-03-18", sex: "male",
    phone: "555-0102", primaryPhysician: "hv-dr-rivera", careStatus: "transferred_out", encounters: [],
  },
];
const fixtureTasks: SyntheticTask[] = [
  { key: "task-admin", clinic: "harbor-view", patient: "fixture-b", category: "request_records",
    title: "Request fictional records", status: "completed", assignee: "hv-fd-okafor", createdBy: "hv-admin-shah",
    createdDay: -20, dueDay: -15, completedDay: 0, outcome: "Fictional records received" },
  { key: "task-clinical", clinic: "harbor-view", category: "clinical_review", title: "Review fictional chart",
    status: "pending", createdBy: "hv-dr-rivera", createdDay: -1, dueDay: 2 },
];
const data: SyntheticSeedData = { patients: fixturePatients, tasks: fixtureTasks };

describe("synthetic seeding and snapshot parity", () => {
  let database: DatabaseHandle;

  beforeAll(async () => {
    vi.stubEnv("SEED_SHARED_DEMO_ACCOUNTS", "false");
    resetEnvForTests();
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database?.close();
    vi.unstubAllEnvs();
    resetEnvForTests();
  });

  async function mapSnapshotIdsToSeedKeys(clinicId: string, snapshots: PatientSnapshot[]) {
    const seedKeys = await withSystem(async (tx) => {
      const rows = await Promise.all([
        tx.select({ id: patients.id, seedKey: patients.seedKey }).from(patients).where(eq(patients.clinicId, clinicId)),
        tx.select({ id: encounters.id, seedKey: encounters.seedKey }).from(encounters).where(eq(encounters.clinicId, clinicId)),
        tx.select({ id: appointments.id, seedKey: appointments.seedKey }).from(appointments).where(eq(appointments.clinicId, clinicId)),
        tx.select({ id: symptomObservations.id, seedKey: symptomObservations.seedKey }).from(symptomObservations).where(eq(symptomObservations.clinicId, clinicId)),
        tx.select({ id: labOrders.id, seedKey: labOrders.seedKey }).from(labOrders).where(eq(labOrders.clinicId, clinicId)),
        tx.select({ id: referrals.id, seedKey: referrals.seedKey }).from(referrals).where(eq(referrals.clinicId, clinicId)),
      ]);
      return new Map(rows.flat().map((row) => [row.id, row.seedKey]));
    }, database);
    const mapId = (id: string): string => {
      const key = seedKeys.get(id);
      if (!key) throw new Error(`Missing seed key for ${id}`);
      return key;
    };
    const mapNullableId = (id: string | null) => id === null ? null : mapId(id);
    return snapshots.map((snapshot) => ({
      ...snapshot,
      patientId: mapId(snapshot.patientId),
      encounters: snapshot.encounters.map((row) => ({ ...row, id: mapId(row.id) })),
      appointments: snapshot.appointments.map((row) => ({ ...row, id: mapId(row.id), originEncounterId: mapNullableId(row.originEncounterId) })),
      symptomObservations: snapshot.symptomObservations.map((row) => ({ ...row, id: mapId(row.id), encounterId: mapId(row.encounterId) })),
      labOrders: snapshot.labOrders.map((row) => ({ ...row, id: mapId(row.id), encounterId: mapNullableId(row.encounterId) })),
      referrals: snapshot.referrals.map((row) => ({ ...row, id: mapId(row.id), encounterId: mapNullableId(row.encounterId) })),
    }));
  }

  it("maps UTC day offsets consistently across month boundaries and rejects malformed offsets", () => {
    expect(dateAtOffset("2024-03-01T01:30:00Z", -1)).toBe("2024-02-29T16:00:00.000Z");
    expect(dateAtOffset("2026-06-01", 0)).toBe("2026-06-01T16:00:00.000Z");
    expect(() => dateAtOffset("invalid", 1)).toThrow("valid reference date");
    expect(() => dateAtOffset(referenceDate, 1.5)).toThrow("integer day offset");
  });

  it("matches the pure snapshot builder exactly for typed inline fixtures", async () => {
    const seeded = await withSystem((tx) => seedSyntheticClinic(tx, {
      clinicKey: "harbor-view", referenceDate, sandbox: true, data,
    }), database);
    const snapshots = await withTenant({ clinicId: seeded.clinicId, userId: seeded.staffUserIds["hv-dr-rivera"] },
      (tx) => loadPatientSnapshots(tx), database);
    expect(await mapSnapshotIdsToSeedKeys(seeded.clinicId, snapshots))
      .toEqual(buildSnapshotsFromSynthetic(fixturePatients, referenceDate));
    const selected = await withTenant({ clinicId: seeded.clinicId, userId: seeded.staffUserIds["hv-dr-rivera"] },
      (tx) => loadPatientSnapshots(tx, [seeded.patientIds["fixture-b"]]), database);
    expect(selected.map((patient) => patient.patientId)).toEqual([seeded.patientIds["fixture-b"]]);
    expect(await withTenant({ clinicId: seeded.clinicId, userId: seeded.staffUserIds["hv-dr-rivera"] },
      (tx) => loadPatientSnapshots(tx, []), database)).toEqual([]);
  });

  it("seeds the current exported dataset, including empty or partially populated patients arrays", async () => {
    const seeded = await withSystem((tx) => seedSharedDemo(tx, referenceDate), database);
    expect(seeded).toHaveLength(2);
    for (const [index, clinicKey] of (["harbor-view", "orange-grove"] as const).entries()) {
      const clinic = seeded[index];
      const physicianKey = clinicKey === "harbor-view" ? "hv-dr-rivera" : "og-dr-brooks";
      const snapshots = await withTenant({ clinicId: clinic.clinicId, userId: clinic.staffUserIds[physicianKey] },
        (tx) => loadPatientSnapshots(tx), database);
      expect(await mapSnapshotIdsToSeedKeys(clinic.clinicId, snapshots)).toEqual(
        buildSnapshotsFromSynthetic(exportedPatients.filter((patient) => patient.clinic === clinicKey), referenceDate),
      );
    }
  });

  it("creates distinct passwordless sandbox staff and preserves seed keys and deterministic MRNs", async () => {
    const first = await withSystem((tx) => seedSyntheticClinic(tx, {
      clinicKey: "harbor-view", referenceDate, sandbox: true, data,
    }), database);
    const second = await withSystem((tx) => seedSyntheticClinic(tx, {
      clinicKey: "harbor-view", referenceDate, sandbox: true, data,
    }), database);
    const firstUsers = await withSystem((tx) => tx.select().from(users).where(inArray(users.id, Object.values(first.staffUserIds))), database);
    expect(firstUsers).toHaveLength(5);
    expect(firstUsers.every((user) => user.passwordHash === null && user.isPlaceholder && user.seedKey && /\+[^@]+@sandbox\.demo\.test$/.test(user.email))).toBe(true);
    expect(Object.values(first.staffUserIds).some((id) => Object.values(second.staffUserIds).includes(id))).toBe(false);
    const seededPatients = await withSystem((tx) => tx.select({ key: patients.seedKey, mrn: patients.demoMrn })
      .from(patients).where(eq(patients.clinicId, first.clinicId)).orderBy(patients.seedKey), database);
    expect(seededPatients).toEqual([{ key: "fixture-a", mrn: "DEMO-00001" }, { key: "fixture-b", mrn: "DEMO-00002" }]);
  });

  it("resets clinical, task, and flag data while preserving memberships and append-only audit history", async () => {
    const seeded = await withSystem((tx) => seedSyntheticClinic(tx, {
      clinicKey: "harbor-view", referenceDate, sandbox: true, data,
    }), database);
    const memberRows = await withSystem((tx) => tx.select().from(memberships).where(eq(memberships.clinicId, seeded.clinicId)), database);
    await withSystem(async (tx) => {
      const actorUserId = seeded.staffUserIds["hv-dr-rivera"];
      await tx.insert(auditLogs).values({ clinicId: seeded.clinicId, actorUserId, action: "demo.fixture", entityType: "clinic", entityId: seeded.clinicId });
      await tx.insert(detectionRuns).values({ clinicId: seeded.clinicId, provider: "rules", rulesVersion: "1.0.0", asOf: dateAtOffset(referenceDate, 0), startedBy: actorUserId, patientsEvaluated: 2, findingsCount: 1 });
      const [flag] = await tx.insert(detectionFlags).values({
        clinicId: seeded.clinicId, patientId: seeded.patientIds["fixture-b"], ruleId: "overdue-follow-up", ruleVersion: "1.0.0",
        fingerprint: "fixture:flag", subjectType: "encounter", subjectId: "fixture-subject", title: "Fictional flag",
        rationale: "Fictional rationale", evidence: [], missingInfo: [], evidenceHash: "fixture-hash",
      }).returning({ id: detectionFlags.id });
      await tx.insert(flagEvents).values({ clinicId: seeded.clinicId, flagId: flag.id, eventType: "created", actorUserId });
      await tx.insert(flagFeedback).values({ clinicId: seeded.clinicId, flagId: flag.id, userId: actorUserId, verdict: "accurate" });
    }, database);
    const reset = await withSystem((tx) => resetClinicDemoData(tx, seeded.clinicId, "harbor-view", "2026-07-01", data), database);
    expect(reset.staffUserIds).toEqual(seeded.staffUserIds);
    expect(reset.patientIds["fixture-b"]).not.toBe(seeded.patientIds["fixture-b"]);
    expect(await withSystem((tx) => tx.select().from(memberships).where(eq(memberships.clinicId, seeded.clinicId)), database)).toEqual(memberRows);
    expect(await withSystem((tx) => tx.select().from(auditLogs).where(eq(auditLogs.clinicId, seeded.clinicId)), database)).toHaveLength(1);
    const remainingFlags = await withSystem(async (tx) => Promise.all([
      tx.select().from(flagEvents).where(eq(flagEvents.clinicId, seeded.clinicId)),
      tx.select().from(flagFeedback).where(eq(flagFeedback.clinicId, seeded.clinicId)),
      tx.select().from(detectionFlags).where(eq(detectionFlags.clinicId, seeded.clinicId)),
      tx.select().from(detectionRuns).where(eq(detectionRuns.clinicId, seeded.clinicId)),
    ]), database);
    expect(remainingFlags).toEqual([[], [], [], []]);
    const resetTasks = await withSystem((tx) => tx.select().from(tasks).where(eq(tasks.clinicId, seeded.clinicId)), database);
    expect(resetTasks).toHaveLength(2);
    const completedTask = resetTasks.find((task) => task.seedKey === "task-admin");
    expect(new Date(completedTask!.completedAt!).toISOString()).toBe("2026-07-01T16:00:00.000Z");
    const snapshots = await withTenant({ clinicId: seeded.clinicId, userId: seeded.staffUserIds["hv-dr-rivera"] },
      (tx) => loadPatientSnapshots(tx), database);
    expect(await mapSnapshotIdsToSeedKeys(seeded.clinicId, snapshots))
      .toEqual(buildSnapshotsFromSynthetic(fixturePatients, "2026-07-01"));
  });
});
