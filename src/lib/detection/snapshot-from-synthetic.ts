import type { SyntheticPatient } from "@/data/synthetic/types";
import {
  dateAtOffset,
  optionalDateAtOffset,
  symptomSeedKey,
  type ReferenceDate,
} from "@/lib/demo/dates";
import type { PatientSnapshot } from "./types";

const byKey = <T extends { key: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.key.localeCompare(b.key));

/** Dates are materialized here; the detection engine applies its injected asOf cutoff. */
export function buildSnapshotsFromSynthetic(
  patients: readonly SyntheticPatient[],
  referenceDate: ReferenceDate,
): PatientSnapshot[] {
  return byKey(patients).map((patient) => ({
    patientId: patient.key,
    careStatus: patient.careStatus,
    encounters: byKey(patient.encounters).map((encounter) => ({
      id: encounter.key,
      occurredAt: dateAtOffset(referenceDate, encounter.day),
      status: encounter.status ?? "completed",
      type: encounter.type,
      chiefComplaint: encounter.chiefComplaint,
      followUpKind: encounter.followUp.kind,
      followUpIntervalDays: encounter.followUp.intervalDays ?? null,
    })),
    appointments: byKey(patient.appointments ?? []).map((appointment) => ({
      id: appointment.key,
      scheduledFor: dateAtOffset(referenceDate, appointment.day),
      purpose: appointment.purpose,
      status: appointment.status,
      statusReason: appointment.statusReason ?? null,
      originEncounterId: appointment.originEncounter ?? null,
    })),
    symptomObservations: patient.encounters.flatMap((encounter) =>
      (encounter.symptoms ?? []).map((symptom, index) => ({
        id: symptomSeedKey(encounter.key, index),
        encounterId: encounter.key,
        observedAt: dateAtOffset(referenceDate, encounter.day),
        symptomCode: symptom.code,
        label: symptom.label,
        status: symptom.status,
      })),
    ).sort((a, b) => a.id.localeCompare(b.id)),
    labOrders: byKey(patient.labs ?? []).map((lab) => ({
      id: lab.key,
      encounterId: lab.encounter ?? null,
      testName: lab.testName,
      orderedAt: dateAtOffset(referenceDate, lab.day),
      expectedWithinDays: lab.expectedWithinDays,
      status: lab.status,
      collectedAt: optionalDateAtOffset(referenceDate, lab.collectedDay),
      resultedAt: optionalDateAtOffset(referenceDate, lab.resultedDay),
      symptomCode: lab.symptomCode ?? null,
    })),
    referrals: byKey(patient.referrals ?? []).map((referral) => ({
      id: referral.key,
      encounterId: referral.encounter ?? null,
      specialty: referral.specialty,
      referredAt: dateAtOffset(referenceDate, referral.day),
      expectedWithinDays: referral.expectedWithinDays,
      status: referral.status,
      specialistAppointmentAt: optionalDateAtOffset(referenceDate, referral.specialistAppointmentDay),
      recordsReceivedAt: optionalDateAtOffset(referenceDate, referral.recordsReceivedDay),
      symptomCode: referral.symptomCode ?? null,
    })),
  }));
}
