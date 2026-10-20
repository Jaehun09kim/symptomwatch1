/** Human-readable labels shared by the marketing previews and the app. */
import type { RuleId } from "@/lib/detection/types";

export type TaskStatus = "pending" | "in_progress" | "completed" | "needs_review";
export type TaskCategory =
  | "call_patient"
  | "confirm_appointment"
  | "request_records"
  | "lab_follow_up"
  | "admin_other"
  | "clinical_review";
export type MemberRole = "clinic_admin" | "physician" | "staff";
export type FlagStatus = "open" | "confirmed" | "dismissed" | "resolved_by_data" | "suppressed";

export const taskStatusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Needs review",
};

export const taskCategoryLabel: Record<TaskCategory, string> = {
  call_patient: "Call to make",
  confirm_appointment: "Confirm appointment",
  request_records: "Specialist records",
  lab_follow_up: "Lab follow-up",
  admin_other: "Other admin",
  clinical_review: "Clinical review",
};

export const roleLabel: Record<MemberRole, string> = {
  clinic_admin: "Practice admin",
  physician: "Physician",
  staff: "Front desk",
};

export const ruleLabel: Record<RuleId, string> = {
  "overdue-follow-up": "Follow-up visit appears overdue",
  "lab-result-missing": "Lab result not documented",
  "referral-outcome-missing": "Referral outcome not recorded",
  "persistent-symptom-unresolved": "Recurring symptom without documented plan",
};

export const ruleShortLabel: Record<RuleId, string> = {
  "overdue-follow-up": "Overdue follow-up",
  "lab-result-missing": "Lab result",
  "referral-outcome-missing": "Referral outcome",
  "persistent-symptom-unresolved": "Recurring symptom",
};

export const flagStatusLabel: Record<FlagStatus, string> = {
  open: "Awaiting review",
  confirmed: "Gap confirmed",
  dismissed: "Dismissed",
  resolved_by_data: "Resolved by new data",
  suppressed: "Rule turned off",
};

export type DismissReason = "expected" | "addressed_elsewhere" | "not_clinically_relevant" | "data_error" | "other";

export const dismissReasonLabel: Record<DismissReason, string> = {
  expected: "Expected — the gap is intentional or planned",
  addressed_elsewhere: "Addressed elsewhere — documented outside SymptomWatch",
  not_clinically_relevant: "Not clinically relevant for this patient",
  data_error: "Data error — the record is wrong or incomplete",
  other: "Other",
};

export const dismissReasonShortLabel: Record<DismissReason, string> = {
  expected: "Expected",
  addressed_elsewhere: "Addressed elsewhere",
  not_clinically_relevant: "Not relevant",
  data_error: "Data error",
  other: "Other",
};

export const encounterTypeLabel = {
  office_visit: "Office visit",
  telehealth: "Telehealth visit",
  annual_exam: "Annual exam",
  urgent_visit: "Urgent visit",
} as const;

export const appointmentPurposeLabel = {
  follow_up: "Follow-up",
  lab_draw: "Lab draw",
  annual: "Annual exam",
  new_concern: "New concern",
  specialist: "Specialist",
} as const;

export const appointmentStatusLabel = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled_by_patient: "Cancelled by patient",
  cancelled_by_clinic: "Cancelled by clinic",
  rescheduled: "Rescheduled",
} as const;

export const labStatusLabel = {
  ordered: "Ordered — not yet collected",
  collected: "Collected — awaiting result",
  resulted: "Resulted",
  cancelled: "Cancelled",
} as const;

export const referralStatusLabel = {
  sent: "Sent — no appointment documented",
  scheduled: "Specialist appointment scheduled",
  seen: "Seen — awaiting records",
  records_received: "Records received",
  declined: "Declined by patient",
  cancelled: "Cancelled",
} as const;

export const symptomStatusLabel = {
  active: "Active",
  improving: "Improving",
  resolved: "Resolved",
  chronic_managed: "Chronic — managed",
} as const;
