/**
 * Synthetic scenario types.
 *
 * EVERYTHING in src/data/synthetic is fictional. Names, dates of birth, phone
 * numbers (555-01xx is reserved for fiction), and clinical details are invented
 * for demonstration and evaluation only. No real patient information.
 *
 * Dates are expressed as integer day offsets relative to a reference date
 * (0 = reference date, negative = past, positive = future). The seeder maps
 * offsets onto "today" so the demo stays current; the evaluator maps them onto
 * a fixed reference date so results are reproducible.
 */

export type DayOffset = number;

export type ClinicKey = "harbor-view" | "orange-grove";
export type StaffRole = "clinic_admin" | "physician" | "staff";

export interface SyntheticClinic {
  key: ClinicKey;
  name: string;
  slug: string;
  city: string;
}

export interface SyntheticStaff {
  key: string;
  clinic: ClinicKey;
  displayName: string;
  email: string;
  role: StaffRole;
  /** Short credential suffix shown in UI, e.g. "MD". */
  credentials?: string;
}

export type EncounterType = "office_visit" | "telehealth" | "annual_exam" | "urgent_visit";
export type FollowUpKind = "interval" | "as_needed" | "none";
export type SymptomStatus = "active" | "improving" | "resolved" | "chronic_managed";

export interface SyntheticSymptom {
  code: string;
  label: string;
  status: SymptomStatus;
  note?: string;
}

export interface SyntheticEncounter {
  key: string;
  day: DayOffset;
  type: EncounterType;
  /** Defaults to "completed". */
  status?: "completed" | "cancelled";
  provider: string; // staff key
  chiefComplaint: string;
  assessment: string;
  plan: string;
  followUp: { kind: FollowUpKind; intervalDays?: number };
  symptoms?: SyntheticSymptom[];
}

export type AppointmentPurpose = "follow_up" | "lab_draw" | "annual" | "new_concern" | "specialist";
export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled_by_patient"
  | "cancelled_by_clinic"
  | "rescheduled";

export interface SyntheticAppointment {
  key: string;
  day: DayOffset;
  purpose: AppointmentPurpose;
  status: AppointmentStatus;
  statusReason?: string;
  originEncounter?: string;
  completedEncounter?: string;
}

export type LabStatus = "ordered" | "collected" | "resulted" | "cancelled";

export interface SyntheticLab {
  key: string;
  encounter?: string;
  day: DayOffset; // ordered
  testName: string;
  expectedWithinDays: number;
  status: LabStatus;
  collectedDay?: DayOffset;
  resultedDay?: DayOffset;
  resultSummary?: string;
  statusReason?: string;
  symptomCode?: string;
}

export type ReferralStatus = "sent" | "scheduled" | "seen" | "records_received" | "declined" | "cancelled";

export interface SyntheticReferral {
  key: string;
  encounter?: string;
  day: DayOffset; // referred
  specialty: string;
  reason: string;
  expectedWithinDays: number;
  status: ReferralStatus;
  specialistAppointmentDay?: DayOffset;
  recordsReceivedDay?: DayOffset;
  outcomeSummary?: string;
  statusReason?: string;
  symptomCode?: string;
}

export type PatientSex = "female" | "male";
export type CareStatus = "active" | "transferred_out";

/** Scenario categories used to describe coverage of the dataset. */
export type ScenarioTag =
  | "missed-follow-up"
  | "incomplete-lab"
  | "pending-referral"
  | "completed-plan"
  | "persistent-documented-symptom"
  | "persistent-undocumented-symptom"
  | "legitimate-scheduling-change"
  | "boundary-window"
  | "false-positive-challenge"
  | "false-negative-challenge"
  | "care-transferred"
  | "declined-or-cancelled";

export interface SyntheticPatient {
  key: string;
  clinic: ClinicKey;
  tags: ScenarioTag[];
  /** Plain-language description of the scenario for reviewers (fictional). */
  narrative: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd, fictional
  sex: PatientSex;
  phone: string; // fictional 555-01xx range only
  primaryPhysician: string; // staff key
  careStatus: CareStatus;
  encounters: SyntheticEncounter[];
  appointments?: SyntheticAppointment[];
  labs?: SyntheticLab[];
  referrals?: SyntheticReferral[];
}

export type TaskCategory =
  | "call_patient"
  | "confirm_appointment"
  | "request_records"
  | "lab_follow_up"
  | "admin_other"
  | "clinical_review";
export type TaskStatus = "pending" | "in_progress" | "completed" | "needs_review";

export interface SyntheticTask {
  key: string;
  clinic: ClinicKey;
  patient?: string; // patient key
  category: TaskCategory;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string; // staff key
  createdBy: string; // staff key
  createdDay: DayOffset;
  dueDay: DayOffset;
  completedDay?: DayOffset;
  outcome?: string;
}
