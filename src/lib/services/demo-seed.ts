import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  clinics as syntheticClinics,
  patients as syntheticPatients,
  staff as syntheticStaff,
  tasks as syntheticTasks,
  type ClinicKey,
  type SyntheticPatient,
  type SyntheticTask,
} from "@/data/synthetic";
import { hashPassword } from "@/lib/auth/password";
import {
  appointments,
  clinics,
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
import type { DbTransaction } from "@/lib/db/types";
import {
  dateAtOffset,
  optionalDateAtOffset,
  symptomSeedKey,
  type ReferenceDate,
} from "@/lib/demo/dates";
import { getEnv } from "@/lib/env";
import { detectForClinic } from "./detection-system";

export interface SyntheticSeedData {
  patients: readonly SyntheticPatient[];
  tasks: readonly SyntheticTask[];
}

export interface SeedClinicOptions {
  clinicKey: ClinicKey;
  referenceDate: ReferenceDate;
  clinicName?: string;
  sandbox?: boolean;
  ownerUserId?: string;
  /** Allows fixture-based seeding without changing the authored demo dataset. */
  data?: SyntheticSeedData;
}

export interface SeededClinic {
  clinicId: string;
  staffUserIds: Record<string, string>;
  patientIds: Record<string, string>;
}

const defaultData: SyntheticSeedData = { patients: syntheticPatients, tasks: syntheticTasks };

function requiredId(ids: Record<string, string>, key: string, kind: string): string {
  const id = ids[key];
  if (!id) throw new Error(`Missing synthetic ${kind} seed key: ${key}`);
  return id;
}

async function seedClinicalData(
  tx: DbTransaction,
  clinicId: string,
  clinicKey: ClinicKey,
  referenceDate: ReferenceDate,
  staffUserIds: Record<string, string>,
  data: SyntheticSeedData,
): Promise<Record<string, string>> {
  const patientIds: Record<string, string> = {};
  const clinicPatients = data.patients
    .filter((patient) => patient.clinic === clinicKey)
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const [index, patient] of clinicPatients.entries()) {
    const patientId = randomUUID();
    patientIds[patient.key] = patientId;
    await tx.insert(patients).values({
      id: patientId,
      clinicId,
      demoMrn: `DEMO-${String(index + 1).padStart(5, "0")}`,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.sex,
      phone: patient.phone,
      primaryPhysicianId: requiredId(staffUserIds, patient.primaryPhysician, "physician"),
      careStatus: patient.careStatus,
      isSynthetic: true,
      seedKey: patient.key,
    });

    const encounterIds: Record<string, string> = {};
    for (const encounter of patient.encounters) {
      const encounterId = randomUUID();
      encounterIds[encounter.key] = encounterId;
      const occurredAt = dateAtOffset(referenceDate, encounter.day);
      await tx.insert(encounters).values({
        id: encounterId,
        clinicId,
        patientId,
        occurredAt,
        status: encounter.status ?? "completed",
        encounterType: encounter.type,
        providerId: requiredId(staffUserIds, encounter.provider, "provider"),
        chiefComplaint: encounter.chiefComplaint,
        assessment: encounter.assessment,
        plan: encounter.plan,
        followUpKind: encounter.followUp.kind,
        followUpIntervalDays: encounter.followUp.intervalDays ?? null,
        seedKey: encounter.key,
      });

      if (encounter.symptoms?.length) {
        await tx.insert(symptomObservations).values(encounter.symptoms.map((symptom, symptomIndex) => ({
          clinicId,
          patientId,
          encounterId,
          symptomCode: symptom.code,
          label: symptom.label,
          observedAt: occurredAt,
          status: symptom.status,
          note: symptom.note ?? null,
          seedKey: symptomSeedKey(encounter.key, symptomIndex),
        })));
      }
    }

    for (const appointment of patient.appointments ?? []) {
      await tx.insert(appointments).values({
        clinicId,
        patientId,
        scheduledFor: dateAtOffset(referenceDate, appointment.day),
        purpose: appointment.purpose,
        status: appointment.status,
        statusReason: appointment.statusReason ?? null,
        originEncounterId: appointment.originEncounter
          ? requiredId(encounterIds, appointment.originEncounter, "encounter") : null,
        completedEncounterId: appointment.completedEncounter
          ? requiredId(encounterIds, appointment.completedEncounter, "encounter") : null,
        seedKey: appointment.key,
      });
    }

    for (const lab of patient.labs ?? []) {
      await tx.insert(labOrders).values({
        clinicId,
        patientId,
        encounterId: lab.encounter ? requiredId(encounterIds, lab.encounter, "encounter") : null,
        testName: lab.testName,
        orderedAt: dateAtOffset(referenceDate, lab.day),
        expectedWithinDays: lab.expectedWithinDays,
        status: lab.status,
        collectedAt: optionalDateAtOffset(referenceDate, lab.collectedDay),
        resultedAt: optionalDateAtOffset(referenceDate, lab.resultedDay),
        resultSummary: lab.resultSummary ?? null,
        statusReason: lab.statusReason ?? null,
        symptomCode: lab.symptomCode ?? null,
        seedKey: lab.key,
      });
    }

    for (const referral of patient.referrals ?? []) {
      await tx.insert(referrals).values({
        clinicId,
        patientId,
        encounterId: referral.encounter ? requiredId(encounterIds, referral.encounter, "encounter") : null,
        specialty: referral.specialty,
        reason: referral.reason,
        referredAt: dateAtOffset(referenceDate, referral.day),
        expectedWithinDays: referral.expectedWithinDays,
        status: referral.status,
        specialistAppointmentAt: optionalDateAtOffset(referenceDate, referral.specialistAppointmentDay),
        recordsReceivedAt: optionalDateAtOffset(referenceDate, referral.recordsReceivedDay),
        outcomeSummary: referral.outcomeSummary ?? null,
        statusReason: referral.statusReason ?? null,
        symptomCode: referral.symptomCode ?? null,
        seedKey: referral.key,
      });
    }
  }

  for (const task of data.tasks.filter((entry) => entry.clinic === clinicKey)) {
    const createdAt = dateAtOffset(referenceDate, task.createdDay);
    const completedAt = optionalDateAtOffset(referenceDate, task.completedDay);
    await tx.insert(tasks).values({
      clinicId,
      patientId: task.patient ? requiredId(patientIds, task.patient, "patient") : null,
      category: task.category,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      assigneeId: task.assignee ? requiredId(staffUserIds, task.assignee, "assignee") : null,
      createdBy: requiredId(staffUserIds, task.createdBy, "task creator"),
      dueDate: dateAtOffset(referenceDate, task.dueDay),
      outcome: task.outcome ?? null,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      seedKey: task.key,
    });
  }
  return patientIds;
}

/** Runs detection inside the same transaction after a full seed/reset, so a fresh clinic opens with flags. */
export async function afterSeed(
  tx: DbTransaction,
  clinicId: string,
  referenceDate: ReferenceDate,
): Promise<void> {
  void referenceDate; // seeded dates are relative to the reference date; detection evaluates "now"
  await detectForClinic(tx, clinicId);
}

/** Must run in a system transaction; tenant roles cannot provision identities or clinics. */
export async function seedSyntheticClinic(
  tx: DbTransaction,
  options: SeedClinicOptions,
): Promise<SeededClinic> {
  const { clinicKey, referenceDate, sandbox = false, ownerUserId } = options;
  const clinic = syntheticClinics.find((entry) => entry.key === clinicKey);
  if (!clinic) throw new Error(`Unknown synthetic clinic: ${clinicKey}`);
  const env = getEnv();
  const clinicId = randomUUID();
  const suffix = clinicId.slice(0, 8);
  await tx.insert(clinics).values({
    id: clinicId,
    name: options.clinicName ?? clinic.name,
    slug: sandbox ? `${clinic.slug}-${suffix}` : clinic.slug,
    isSandbox: sandbox,
    ownerUserId: ownerUserId ?? null,
    expiresAt: sandbox ? dateAtOffset(referenceDate, 7) : null,
    seedKey: clinicKey,
  });

  const staffUserIds: Record<string, string> = {};
  const sharedLogins = !sandbox && env.SEED_SHARED_DEMO_ACCOUNTS;
  if (sharedLogins && !env.DEMO_ACCOUNT_PASSWORD) {
    throw new Error("Shared demo account seeding requires DEMO_ACCOUNT_PASSWORD");
  }
  // One hash for all shared logins: scrypt is deliberately slow.
  const passwordHash = sharedLogins && env.DEMO_ACCOUNT_PASSWORD
    ? await hashPassword(env.DEMO_ACCOUNT_PASSWORD) : null;
  for (const member of syntheticStaff.filter((entry) => entry.clinic === clinicKey)) {
    const [user] = await tx.insert(users).values({
      email: sharedLogins ? member.email : `${member.key}+${suffix}@sandbox.demo.test`,
      displayName: member.displayName,
      passwordHash,
      isPlaceholder: !sharedLogins,
      seedKey: member.key,
    }).onConflictDoUpdate({
      target: users.email,
      set: { displayName: member.displayName, passwordHash, isPlaceholder: !sharedLogins, seedKey: member.key },
    }).returning({ id: users.id });
    if (!user) throw new Error(`Could not seed staff user: ${member.key}`);
    staffUserIds[member.key] = user.id;
    await tx.insert(memberships).values({
      clinicId,
      userId: user.id,
      role: member.role,
      status: "active",
      seedKey: member.key,
    });
  }

  if (ownerUserId && !Object.values(staffUserIds).includes(ownerUserId)) {
    await tx.insert(memberships).values({ clinicId, userId: ownerUserId, role: "clinic_admin", status: "active" });
  }
  const patientIds = await seedClinicalData(tx, clinicId, clinicKey, referenceDate, staffUserIds, options.data ?? defaultData);
  await afterSeed(tx, clinicId, referenceDate);
  return { clinicId, staffUserIds, patientIds };
}

export async function seedSharedDemo(tx: DbTransaction, referenceDate: ReferenceDate): Promise<SeededClinic[]> {
  const results: SeededClinic[] = [];
  for (const clinic of syntheticClinics) {
    results.push(await seedSyntheticClinic(tx, { clinicKey: clinic.key, referenceDate }));
  }
  return results;
}

/** Retains audit history, identities, memberships, invitations, and the clinic itself. */
export async function resetClinicDemoData(
  tx: DbTransaction,
  clinicId: string,
  clinicKey: ClinicKey,
  referenceDate: ReferenceDate,
  data: SyntheticSeedData = defaultData,
): Promise<SeededClinic> {
  const [clinic] = await tx.select({ id: clinics.id }).from(clinics)
    .where(and(eq(clinics.id, clinicId), eq(clinics.seedKey, clinicKey)));
  if (!clinic) throw new Error("Cannot reset an unknown clinic or mismatched synthetic clinic key");
  const existingStaff = await tx.select({ key: memberships.seedKey, userId: memberships.userId })
    .from(memberships).where(eq(memberships.clinicId, clinicId));
  const staffUserIds: Record<string, string> = {};
  for (const member of existingStaff) {
    if (member.key) staffUserIds[member.key] = member.userId;
  }

  await tx.delete(tasks).where(eq(tasks.clinicId, clinicId));
  await tx.delete(flagEvents).where(eq(flagEvents.clinicId, clinicId));
  await tx.delete(flagFeedback).where(eq(flagFeedback.clinicId, clinicId));
  await tx.delete(detectionFlags).where(eq(detectionFlags.clinicId, clinicId));
  await tx.delete(detectionRuns).where(eq(detectionRuns.clinicId, clinicId));
  await tx.delete(appointments).where(eq(appointments.clinicId, clinicId));
  await tx.delete(labOrders).where(eq(labOrders.clinicId, clinicId));
  await tx.delete(referrals).where(eq(referrals.clinicId, clinicId));
  await tx.delete(symptomObservations).where(eq(symptomObservations.clinicId, clinicId));
  await tx.delete(encounters).where(eq(encounters.clinicId, clinicId));
  await tx.delete(patients).where(eq(patients.clinicId, clinicId));

  const patientIds = await seedClinicalData(tx, clinicId, clinicKey, referenceDate, staffUserIds, data);
  await afterSeed(tx, clinicId, referenceDate);
  return { clinicId, staffUserIds, patientIds };
}
