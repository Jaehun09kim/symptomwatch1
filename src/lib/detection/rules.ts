/**
 * Rule-based detection v1 — implements docs/PRODUCT_SPEC.md §6 and §6.5
 * verbatim. Each rule is a pure function of a point-in-time snapshot.
 *
 * Findings describe possible DOCUMENTATION gaps. They never diagnose, rank
 * urgency, recommend treatment, or change care plans.
 */
import { addDays, daysBetween, formatDay, isOnOrBefore, utcDay, windowPassed } from "./time";
import {
  RULES_VERSION,
  type AppointmentSnapshot,
  type DetectionContext,
  type EncounterSnapshot,
  type EvidenceRef,
  type Finding,
  type MissingInfo,
  type PatientSnapshot,
  type RuleId,
  type SubjectType,
} from "./types";

export type Rule = (patient: PatientSnapshot, ctx: DetectionContext) => Finding[];

function finding(
  ruleId: RuleId,
  patient: PatientSnapshot,
  subject: { type: SubjectType; id: string },
  body: { title: string; rationale: string; evidence: EvidenceRef[]; missingInfo: MissingInfo[] },
): Finding {
  return {
    ruleId,
    ruleVersion: RULES_VERSION,
    patientId: patient.patientId,
    subject,
    fingerprint: `${ruleId}:${subject.type}:${subject.id}`,
    ...body,
  };
}

/** Completed encounters known as of `asOf`, oldest first. */
function completedEncounters(patient: PatientSnapshot, asOf: string): EncounterSnapshot[] {
  return patient.encounters
    .filter((encounter) => encounter.status === "completed" && isOnOrBefore(encounter.occurredAt, asOf))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

/** The ordering/referring visit, only if it is part of the snapshot (dated on/before `asOf`). */
function linkedEncounter(patient: PatientSnapshot, encounterId: string | null, asOf: string): EncounterSnapshot | undefined {
  return patient.encounters.find((item) => item.id === encounterId && isOnOrBefore(item.occurredAt, asOf));
}

const isFutureBooking = (appointment: AppointmentSnapshot, asOf: string) =>
  (appointment.status === "scheduled" || appointment.status === "confirmed") && Date.parse(appointment.scheduledFor) > Date.parse(asOf);

function futureFollowUp(patient: PatientSnapshot, asOf: string): AppointmentSnapshot | undefined {
  return patient.appointments.find((appointment) => appointment.purpose === "follow_up" && isFutureBooking(appointment, asOf));
}

function encounterEvidence(encounter: EncounterSnapshot, role: EvidenceRef["role"], suffix?: string): EvidenceRef {
  return {
    kind: "encounter",
    id: encounter.id,
    date: encounter.occurredAt,
    label: `Visit — ${encounter.chiefComplaint}${suffix ? ` (${suffix})` : ""}`,
    role,
  };
}

const MISSED_STATUS: Partial<Record<AppointmentSnapshot["status"], string>> = {
  no_show: "no-show",
  cancelled_by_patient: "cancelled by patient",
  cancelled_by_clinic: "cancelled by clinic",
  rescheduled: "rescheduled",
};

// ---------------------------------------------------------------- R1
export const overdueFollowUp: Rule = (patient, { asOf, config }) => {
  const visits = completedEncounters(patient, asOf);
  const basis = [...visits].reverse().find((encounter) => encounter.followUpKind === "interval" && encounter.followUpIntervalDays);
  if (!basis || !basis.followUpIntervalDays) return [];
  const interval = basis.followUpIntervalDays;
  const laterVisit = visits.some((encounter) => utcDay(encounter.occurredAt) > utcDay(basis.occurredAt));
  if (laterVisit || futureFollowUp(patient, asOf)) return [];
  if (!windowPassed(basis.occurredAt, asOf, interval + config.overdueFollowUp.graceDays)) return [];

  const due = addDays(basis.occurredAt, interval);
  const missed = patient.appointments
    .filter((appointment) => MISSED_STATUS[appointment.status] && utcDay(appointment.scheduledFor) > utcDay(basis.occurredAt) && isOnOrBefore(appointment.scheduledFor, asOf))
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));

  return [finding("overdue-follow-up", patient, { type: "encounter", id: basis.id }, {
    title: `No documented follow-up visit after the ${formatDay(basis.occurredAt)} request to return within ${interval} days`,
    rationale: `A return visit was requested within ${interval} days (due ${formatDay(due)}). More than ${config.overdueFollowUp.graceDays} days have passed since the due date with no completed visit and no upcoming follow-up appointment on file.`,
    evidence: [
      encounterEvidence(basis, "basis", `return in ${interval} days requested`),
      ...missed.map((appointment): EvidenceRef => ({
        kind: "appointment",
        id: appointment.id,
        date: appointment.scheduledFor,
        label: `Follow-up appointment — ${MISSED_STATUS[appointment.status]}${appointment.statusReason ? `: ${appointment.statusReason}` : ""}`,
        role: "supporting",
      })),
    ],
    missingInfo: [
      { code: "no_completed_visit_after", description: `No completed visit after ${formatDay(basis.occurredAt)}`, certainty: "not_documented" },
      { code: "no_future_follow_up", description: "No upcoming follow-up appointment on file", certainty: "not_documented" },
    ],
  })];
};

// ---------------------------------------------------------------- R2
export const labResultMissing: Rule = (patient, { asOf, config }) => {
  const futureDraw = patient.appointments.some((appointment) => appointment.purpose === "lab_draw" && isFutureBooking(appointment, asOf));
  const findings: Finding[] = [];
  for (const lab of patient.labOrders) {
    if (lab.status !== "ordered" && lab.status !== "collected") continue;
    if (!isOnOrBefore(lab.orderedAt, asOf)) continue;
    if (lab.status === "ordered" && futureDraw) continue;
    const window = lab.expectedWithinDays + config.labResultMissing.graceDays;
    if (!windowPassed(lab.orderedAt, asOf, window)) continue;

    const encounter = linkedEncounter(patient, lab.encounterId, asOf);
    const collected = lab.status === "collected";
    findings.push(finding("lab-result-missing", patient, { type: "lab_order", id: lab.id }, {
      title: `${lab.testName} ordered ${formatDay(lab.orderedAt)} has no documented ${collected ? "result" : "collection or result"}`,
      rationale: `Results were expected within ${lab.expectedWithinDays} day${lab.expectedWithinDays === 1 ? "" : "s"}. More than ${window} days (expected turnaround plus ${config.labResultMissing.graceDays}-day grace) have passed${collected ? " since the order, and the specimen was collected" : ""} without a result on file.`,
      evidence: [
        { kind: "lab_order", id: lab.id, date: lab.orderedAt, label: `Lab order — ${lab.testName} (expected within ${lab.expectedWithinDays} days)`, role: "basis" },
        ...(encounter ? [encounterEvidence(encounter, "supporting", "ordering visit")] : []),
      ],
      missingInfo: [collected
        ? { code: "no_result_after_collection", description: `Specimen collected${lab.collectedAt ? ` ${formatDay(lab.collectedAt)}` : " (date not recorded)"}; no result documented`, certainty: "not_documented" }
        : { code: "no_collection_or_result", description: "No specimen collection or result documented", certainty: "not_documented" }],
    }));
  }
  return findings;
};

// ---------------------------------------------------------------- R3
export const referralOutcomeMissing: Rule = (patient, { asOf, config }) => {
  const { sentGraceDays, postVisitRecordsDays } = config.referralOutcomeMissing;
  const findings: Finding[] = [];
  for (const referral of patient.referrals) {
    if (referral.status !== "sent" && referral.status !== "scheduled" && referral.status !== "seen") continue;
    if (!isOnOrBefore(referral.referredAt, asOf)) continue;
    // Records documented as received (on/before the snapshot) close the loop whatever the status says.
    if (referral.recordsReceivedAt && isOnOrBefore(referral.recordsReceivedAt, asOf)) continue;
    const encounter = linkedEncounter(patient, referral.encounterId, asOf);
    const evidence: EvidenceRef[] = [
      { kind: "referral", id: referral.id, date: referral.referredAt, label: `Referral to ${referral.specialty} — ${referral.status}`, role: "basis" },
      ...(encounter ? [encounterEvidence(encounter, "supporting", "referring visit")] : []),
    ];

    let missing: MissingInfo | undefined;
    let rationale = "";
    const treatAsSent = referral.status === "sent" || (referral.status === "scheduled" && !referral.specialistAppointmentAt);
    if (treatAsSent) {
      const window = referral.expectedWithinDays + sentGraceDays;
      if (windowPassed(referral.referredAt, asOf, window)) {
        missing = { code: "no_specialist_appointment", description: "No specialist appointment documented", certainty: "not_documented" };
        rationale = `A specialist appointment was expected within ${referral.expectedWithinDays} days of the referral. More than ${window} days have passed with no appointment, consult note, or outcome documented.`;
      }
    } else if (referral.status === "scheduled" && referral.specialistAppointmentAt) {
      if (Date.parse(referral.specialistAppointmentAt) > Date.parse(asOf)) continue;
      if (windowPassed(referral.specialistAppointmentAt, asOf, postVisitRecordsDays)) {
        missing = { code: "no_consult_note", description: "Specialist visit date passed; no consult note received", certainty: "not_documented" };
        rationale = `The specialist appointment was scheduled for ${formatDay(referral.specialistAppointmentAt)}. More than ${postVisitRecordsDays} days have passed with no consult note or records received.`;
      }
    } else {
      const reference = referral.specialistAppointmentAt ?? referral.referredAt;
      if (windowPassed(reference, asOf, postVisitRecordsDays)) {
        missing = { code: "no_consult_note", description: "Visit reported as completed; no consult note received", certainty: "not_documented" };
        rationale = `The specialist visit is recorded as completed (${formatDay(reference)}). More than ${postVisitRecordsDays} days have passed with no consult note or records received.`;
      }
    }
    if (referral.specialistAppointmentAt && referral.status !== "sent") {
      evidence.push({ kind: "referral", id: referral.id, date: referral.specialistAppointmentAt, label: `${referral.specialty} appointment date`, role: "supporting" });
    }
    if (!missing) continue;
    findings.push(finding("referral-outcome-missing", patient, { type: "referral", id: referral.id }, {
      title: `${referral.specialty} referral from ${formatDay(referral.referredAt)} has no recorded outcome`,
      rationale,
      evidence,
      missingInfo: [missing],
    }));
  }
  return findings;
};

// ---------------------------------------------------------------- R4
const RESOLVING = new Set(["improving", "resolved", "chronic_managed"]);

export const persistentSymptomUnresolved: Rule = (patient, { asOf, config }) => {
  const completed = new Map(completedEncounters(patient, asOf).map((encounter) => [encounter.id, encounter]));
  const byCode = new Map<string, PatientSnapshot["symptomObservations"]>();
  for (const observation of patient.symptomObservations) {
    if (!completed.has(observation.encounterId) || !isOnOrBefore(observation.observedAt, asOf)) continue;
    byCode.set(observation.symptomCode, [...(byCode.get(observation.symptomCode) ?? []), observation]);
  }

  const findings: Finding[] = [];
  for (const [code, observations] of byCode) {
    const sorted = [...observations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const encounters = new Set(sorted.map((observation) => observation.encounterId));
    const first = sorted[0];
    const latest = sorted.at(-1)!;
    if (encounters.size < config.persistentSymptom.minEncounters) continue;
    if (daysBetween(first.observedAt, latest.observedAt) < config.persistentSymptom.minSpanDays) continue;

    if (RESOLVING.has(latest.status)) continue;
    const sinceFirst = (date: string) => utcDay(date) >= utcDay(first.observedAt) && isOnOrBefore(date, asOf);
    const workUp =
      patient.labOrders.some((lab) => lab.symptomCode === code && lab.status !== "cancelled" && sinceFirst(lab.orderedAt)) ||
      patient.referrals.some((referral) => referral.symptomCode === code && referral.status !== "cancelled" && referral.status !== "declined" && sinceFirst(referral.referredAt));
    if (workUp || futureFollowUp(patient, asOf)) continue;
    const latestEncounter = completed.get(latest.encounterId)!;
    if (
      latestEncounter.followUpKind === "interval" &&
      latestEncounter.followUpIntervalDays &&
      !windowPassed(latestEncounter.occurredAt, asOf, latestEncounter.followUpIntervalDays + config.overdueFollowUp.graceDays)
    ) continue;

    findings.push(finding("persistent-symptom-unresolved", patient, { type: "symptom", id: `${patient.patientId}:${code}` }, {
      title: `${latest.label} recorded at ${encounters.size} visits since ${formatDay(first.observedAt)} without a documented plan or resolution`,
      rationale: `${latest.label} was reported at ${encounters.size} separate visits over ${daysBetween(first.observedAt, latest.observedAt)} days and is still recorded as active. No resolution, management plan, related lab or referral, or upcoming follow-up is documented. Exact symptom codes are compared; differently worded symptoms are not merged.`,
      evidence: sorted.map((observation, index): EvidenceRef => ({
        kind: "symptom_observation",
        id: observation.id,
        date: observation.observedAt,
        label: `${observation.label} reported — ${observation.status.replace("_", " ")}`,
        role: index === 0 ? "basis" : "supporting",
      })),
      missingInfo: [{
        code: "no_plan_documented",
        description: `No resolution, management plan, work-up, or scheduled follow-up documented for ${latest.label.toLowerCase()}`,
        certainty: "not_documented",
      }],
    }));
  }
  return findings;
};

export const RULES: Record<RuleId, Rule> = {
  "overdue-follow-up": overdueFollowUp,
  "lab-result-missing": labResultMissing,
  "referral-outcome-missing": referralOutcomeMissing,
  "persistent-symptom-unresolved": persistentSymptomUnresolved,
};
