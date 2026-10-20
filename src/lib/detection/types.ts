/**
 * Detection contract (owned by Claude; see docs/COLLABORATION.md).
 *
 * The engine consumes normalized, point-in-time patient snapshots and emits
 * explainable findings. It performs no I/O and never reads the clock: `asOf`
 * is always injected. The same snapshot shape is produced from the database
 * (app) and directly from src/data/synthetic (evaluation), so both paths run
 * identical logic.
 *
 * Findings describe possible DOCUMENTATION gaps for clinician review. They
 * must never diagnose, recommend treatment, rank urgency, or alter care plans.
 */

export const RULES_VERSION = "1.0.0";

export type RuleId =
  | "overdue-follow-up"
  | "lab-result-missing"
  | "referral-outcome-missing"
  | "persistent-symptom-unresolved";

/** ISO-8601 date or timestamp string. Day math uses UTC calendar days. */
export type IsoDate = string;

export interface EncounterSnapshot {
  id: string;
  occurredAt: IsoDate;
  status: "completed" | "cancelled";
  type: "office_visit" | "telehealth" | "annual_exam" | "urgent_visit";
  chiefComplaint: string;
  followUpKind: "interval" | "as_needed" | "none";
  followUpIntervalDays: number | null;
}

export interface AppointmentSnapshot {
  id: string;
  scheduledFor: IsoDate;
  purpose: "follow_up" | "lab_draw" | "annual" | "new_concern" | "specialist";
  status:
    | "scheduled"
    | "confirmed"
    | "completed"
    | "no_show"
    | "cancelled_by_patient"
    | "cancelled_by_clinic"
    | "rescheduled";
  statusReason: string | null;
  originEncounterId: string | null;
}

export interface SymptomObservationSnapshot {
  id: string;
  encounterId: string;
  observedAt: IsoDate;
  symptomCode: string;
  label: string;
  status: "active" | "improving" | "resolved" | "chronic_managed";
}

export interface LabOrderSnapshot {
  id: string;
  encounterId: string | null;
  testName: string;
  orderedAt: IsoDate;
  expectedWithinDays: number;
  status: "ordered" | "collected" | "resulted" | "cancelled";
  collectedAt: IsoDate | null;
  resultedAt: IsoDate | null;
  symptomCode: string | null;
}

export interface ReferralSnapshot {
  id: string;
  encounterId: string | null;
  specialty: string;
  referredAt: IsoDate;
  expectedWithinDays: number;
  status: "sent" | "scheduled" | "seen" | "records_received" | "declined" | "cancelled";
  specialistAppointmentAt: IsoDate | null;
  recordsReceivedAt: IsoDate | null;
  symptomCode: string | null;
}

export interface PatientSnapshot {
  patientId: string;
  careStatus: "active" | "transferred_out";
  encounters: EncounterSnapshot[];
  appointments: AppointmentSnapshot[];
  symptomObservations: SymptomObservationSnapshot[];
  labOrders: LabOrderSnapshot[];
  referrals: ReferralSnapshot[];
}

export type SubjectType = "encounter" | "lab_order" | "referral" | "symptom";

export interface EvidenceRef {
  kind: "encounter" | "appointment" | "lab_order" | "referral" | "symptom_observation";
  id: string;
  date: IsoDate;
  /** Short human-readable description, e.g. "Visit 2026-03-02 — follow-up in 90 days requested". */
  label: string;
  /** `basis` = the record that created the expectation; `supporting` = records consistent with the gap. */
  role: "basis" | "supporting";
}

export interface MissingInfo {
  /** Stable machine code, e.g. "no_completed_visit_after", "no_future_follow_up". */
  code: string;
  description: string;
  /** `not_documented` = expected record absent; `uncertain` = record exists but is incomplete/ambiguous. */
  certainty: "not_documented" | "uncertain";
}

export interface Finding {
  ruleId: RuleId;
  ruleVersion: string;
  patientId: string;
  subject: {
    type: SubjectType;
    /** encounter/lab/referral id; for `symptom`: `${patientId}:${symptomCode}`. */
    id: string;
  };
  /** `${ruleId}:${subject.type}:${subject.id}` */
  fingerprint: string;
  /** What was flagged, phrased as a documentation question. */
  title: string;
  /** Why it was flagged: the rule logic applied to this record, in plain language. */
  rationale: string;
  evidence: EvidenceRef[];
  missingInfo: MissingInfo[];
}

export interface RuleConfig {
  overdueFollowUp: { graceDays: number };
  labResultMissing: { graceDays: number };
  referralOutcomeMissing: { sentGraceDays: number; postVisitRecordsDays: number };
  persistentSymptom: { minEncounters: number; minSpanDays: number };
}

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  overdueFollowUp: { graceDays: 14 },
  labResultMissing: { graceDays: 7 },
  referralOutcomeMissing: { sentGraceDays: 14, postVisitRecordsDays: 14 },
  persistentSymptom: { minEncounters: 2, minSpanDays: 28 },
};

export interface DetectionContext {
  asOf: IsoDate;
  config: RuleConfig;
  /** Rules a clinic has turned off; they produce no findings. */
  disabledRules?: readonly RuleId[];
}

export interface DetectionProvider {
  readonly id: string; // e.g. "rules"
  readonly description: string;
  /** True when the provider transmits data outside this process. Must be false unless separately approved. */
  readonly sendsDataExternally: boolean;
  detect(patients: PatientSnapshot[], ctx: DetectionContext): Promise<Finding[]>;
}
