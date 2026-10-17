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
export type FlagStatus = "open" | "confirmed" | "dismissed" | "resolved_by_data";

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
  clinic_admin: "Clinic admin",
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
};
