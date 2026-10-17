import { and, eq, inArray, sql } from "drizzle-orm";
import {
  appointments,
  encounters,
  labOrders,
  patients,
  referrals,
  symptomObservations,
} from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db/types";
import type { PatientSnapshot } from "@/lib/detection/types";
import type { StaffRole } from "@/data/synthetic/types";

function bySeedKey<T extends { id: string; seedKey: string | null }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.seedKey ?? a.id).localeCompare(b.seedKey ?? b.id));
}

const iso = (timestamp: string): string => new Date(timestamp).toISOString();
const optionalIso = (timestamp: string | null): string | null => timestamp === null ? null : iso(timestamp);

/** Uses the caller's withTenant transaction; clinical fields never enter staff payloads. */
export async function loadPatientSnapshots(
  tx: DbTransaction,
  patientIds?: readonly string[],
): Promise<PatientSnapshot[]> {
  if (patientIds?.length === 0) return [];
  const [context] = await tx.select({ role: sql<StaffRole | null>`app.current_role()` })
    .from(sql`(select 1) as tenant_context`);
  if (!context?.role) return [];
  const clinical = context.role === "physician" || context.role === "clinic_admin";
  const clinicId = sql<string>`app.current_clinic_id()`;
  const selectedPatients = bySeedKey(await tx.select({
    id: patients.id,
    careStatus: patients.careStatus,
    seedKey: patients.seedKey,
  }).from(patients).where(and(
    eq(patients.clinicId, clinicId),
    patientIds ? inArray(patients.id, [...patientIds]) : undefined,
  )));
  if (selectedPatients.length === 0) return [];
  const selectedIds = selectedPatients.map((patient) => patient.id);

  const [encounterRows, appointmentRows, symptomRows, labRows, referralRows] = await Promise.all([
    clinical ? tx.select({
      id: encounters.id,
      patientId: encounters.patientId,
      seedKey: encounters.seedKey,
      occurredAt: encounters.occurredAt,
      status: encounters.status,
      type: encounters.encounterType,
      chiefComplaint: encounters.chiefComplaint,
      followUpKind: encounters.followUpKind,
      followUpIntervalDays: encounters.followUpIntervalDays,
    }).from(encounters).where(and(eq(encounters.clinicId, clinicId), inArray(encounters.patientId, selectedIds))) : [],
    tx.select({
      id: appointments.id,
      patientId: appointments.patientId,
      seedKey: appointments.seedKey,
      scheduledFor: appointments.scheduledFor,
      purpose: appointments.purpose,
      status: appointments.status,
      statusReason: appointments.statusReason,
      originEncounterId: clinical ? appointments.originEncounterId : sql<null>`NULL`,
    }).from(appointments).where(and(eq(appointments.clinicId, clinicId), inArray(appointments.patientId, selectedIds))),
    clinical ? tx.select({
      id: symptomObservations.id,
      patientId: symptomObservations.patientId,
      seedKey: symptomObservations.seedKey,
      encounterId: symptomObservations.encounterId,
      observedAt: symptomObservations.observedAt,
      symptomCode: symptomObservations.symptomCode,
      label: symptomObservations.label,
      status: symptomObservations.status,
    }).from(symptomObservations).where(and(eq(symptomObservations.clinicId, clinicId), inArray(symptomObservations.patientId, selectedIds))) : [],
    clinical ? tx.select({
      id: labOrders.id,
      patientId: labOrders.patientId,
      seedKey: labOrders.seedKey,
      encounterId: labOrders.encounterId,
      testName: labOrders.testName,
      orderedAt: labOrders.orderedAt,
      expectedWithinDays: labOrders.expectedWithinDays,
      status: labOrders.status,
      collectedAt: labOrders.collectedAt,
      resultedAt: labOrders.resultedAt,
      symptomCode: labOrders.symptomCode,
    }).from(labOrders).where(and(eq(labOrders.clinicId, clinicId), inArray(labOrders.patientId, selectedIds))) : [],
    tx.select({
      id: referrals.id,
      patientId: referrals.patientId,
      seedKey: referrals.seedKey,
      encounterId: clinical ? referrals.encounterId : sql<null>`NULL`,
      specialty: referrals.specialty,
      referredAt: referrals.referredAt,
      expectedWithinDays: referrals.expectedWithinDays,
      status: referrals.status,
      specialistAppointmentAt: referrals.specialistAppointmentAt,
      recordsReceivedAt: referrals.recordsReceivedAt,
      symptomCode: clinical ? referrals.symptomCode : sql<null>`NULL`,
    }).from(referrals).where(and(eq(referrals.clinicId, clinicId), inArray(referrals.patientId, selectedIds))),
  ]);

  return selectedPatients.map((patient) => ({
    patientId: patient.id,
    careStatus: patient.careStatus,
    encounters: bySeedKey(encounterRows.filter((row) => row.patientId === patient.id)).map((row) => ({
      id: row.id,
      occurredAt: iso(row.occurredAt),
      status: row.status,
      type: row.type,
      chiefComplaint: row.chiefComplaint,
      followUpKind: row.followUpKind,
      followUpIntervalDays: row.followUpIntervalDays,
    })),
    appointments: bySeedKey(appointmentRows.filter((row) => row.patientId === patient.id)).map((row) => ({
      id: row.id,
      scheduledFor: iso(row.scheduledFor),
      purpose: row.purpose,
      status: row.status,
      statusReason: row.statusReason,
      originEncounterId: row.originEncounterId,
    })),
    symptomObservations: bySeedKey(symptomRows.filter((row) => row.patientId === patient.id)).map((row) => ({
      id: row.id,
      encounterId: row.encounterId,
      observedAt: iso(row.observedAt),
      symptomCode: row.symptomCode,
      label: row.label,
      status: row.status,
    })),
    labOrders: bySeedKey(labRows.filter((row) => row.patientId === patient.id)).map((row) => ({
      id: row.id,
      encounterId: row.encounterId,
      testName: row.testName,
      orderedAt: iso(row.orderedAt),
      expectedWithinDays: row.expectedWithinDays,
      status: row.status,
      collectedAt: optionalIso(row.collectedAt),
      resultedAt: optionalIso(row.resultedAt),
      symptomCode: row.symptomCode,
    })),
    referrals: bySeedKey(referralRows.filter((row) => row.patientId === patient.id)).map((row) => ({
      id: row.id,
      encounterId: row.encounterId,
      specialty: row.specialty,
      referredAt: iso(row.referredAt),
      expectedWithinDays: row.expectedWithinDays,
      status: row.status,
      specialistAppointmentAt: optionalIso(row.specialistAppointmentAt),
      recordsReceivedAt: optionalIso(row.recordsReceivedAt),
      symptomCode: row.symptomCode,
    })),
  }));
}
