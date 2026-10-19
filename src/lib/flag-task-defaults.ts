import type { RuleId } from "@/lib/detection/types";
import type { TaskCategory } from "@/lib/labels";

// Editable workflow targets, not clinical urgency or a recommended care plan.
const DEFAULTS: Record<RuleId, { category: TaskCategory; days: number; action: string }> = {
  "lab-result-missing": { category: "lab_follow_up", days: 3, action: "Check lab status and obtain result" },
  "referral-outcome-missing": { category: "request_records", days: 7, action: "Request specialist outcome records" },
  "overdue-follow-up": { category: "call_patient", days: 2, action: "Call to rebook follow-up" },
  "persistent-symptom-unresolved": { category: "clinical_review", days: 3, action: "Review recurring symptom and document a plan" },
};

/**
 * Default owner: a clinical review stays with the reviewing physician; front-desk
 * work goes to the clinic's front-desk person when there is exactly one, and is
 * otherwise left unassigned ("") for the team to claim — never silently given
 * to the physician who confirmed the gap.
 */
export function flagTaskDefaults(ruleId: RuleId, title: string, reviewerId: string, now = new Date(), frontDeskId?: string) {
  const { category, days, action } = DEFAULTS[ruleId];
  return {
    category,
    title: `${action}: ${title}`.slice(0, 160),
    assigneeId: category === "clinical_review" ? reviewerId : (frontDeskId ?? ""),
    dueDate: new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10),
  };
}
