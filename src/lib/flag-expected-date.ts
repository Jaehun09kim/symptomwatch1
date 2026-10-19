import type { RuleSettingsValues } from "@/lib/detection/clinic-config";
import type { EvidenceRef, MissingInfo, RuleId } from "@/lib/detection/types";
import type { PatientRecord } from "@/lib/services/patients";

type ExpectationRecords = {
  encounters: Array<Pick<PatientRecord["encounters"][number], "id" | "followUpKind" | "followUpIntervalDays" | "occurredAt">>;
  labs: Array<Pick<PatientRecord["labs"][number], "id" | "orderedAt" | "expectedWithinDays">>;
  referrals: Array<Pick<PatientRecord["referrals"][number], "id" | "referredAt" | "expectedWithinDays" | "specialistAppointmentAt">>;
};

const afterDays = (date: string, days: number) => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Display the source expectation, not the later detection/grace deadline. */
export function flagExpectedDate(
  flag: { ruleId: RuleId; evidence: EvidenceRef[]; missingInfo: MissingInfo[] },
  record: ExpectationRecords,
  settings: Pick<RuleSettingsValues, "referralRecordsDays">,
): string | undefined {
  const basis = flag.evidence.find((item) => item.role === "basis");
  if (!basis) return;
  if (flag.ruleId === "overdue-follow-up" && basis.kind === "encounter") {
    const visit = record.encounters.find((row) => row.id === basis.id);
    if (visit?.followUpKind === "interval" && visit.followUpIntervalDays) return afterDays(visit.occurredAt, visit.followUpIntervalDays);
  }
  if (flag.ruleId === "lab-result-missing" && basis.kind === "lab_order") {
    const lab = record.labs.find((row) => row.id === basis.id);
    if (lab) return afterDays(lab.orderedAt, lab.expectedWithinDays);
  }
  if (flag.ruleId === "referral-outcome-missing" && basis.kind === "referral") {
    const referral = record.referrals.find((row) => row.id === basis.id);
    if (!referral) return;
    if (flag.missingInfo.some((item) => item.code === "no_specialist_appointment")) return afterDays(referral.referredAt, referral.expectedWithinDays);
    // Without a dated visit, avoid presenting an inferred visit date as documented.
    if (flag.missingInfo.some((item) => item.code === "no_consult_note") && referral.specialistAppointmentAt) return afterDays(referral.specialistAppointmentAt, settings.referralRecordsDays);
  }
}
