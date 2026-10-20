import type { TaskCategory, TaskStatus } from "@/lib/labels";

const CHOICES = {
  rebooked: { label: "Follow-up booked", status: "completed" },
  confirmed: { label: "Appointment confirmed", status: "completed" },
  received: { label: "Records received", status: "completed" },
  lab_checked: { label: "Lab follow-up completed", status: "completed" },
  plan_documented: { label: "Review complete; plan documented", status: "completed" },
  done: { label: "Task completed", status: "completed" },
  attempted: { label: "Attempted; try again", status: "in_progress" },
  waiting: { label: "Waiting for response", status: "in_progress" },
  review: { label: "Needs review", status: "needs_review" },
} as const satisfies Record<string, { label: string; status: TaskStatus }>;
export type OutcomeChoice = keyof typeof CHOICES;
const COMPLETION: Record<TaskCategory, OutcomeChoice> = {
  call_patient: "rebooked", confirm_appointment: "confirmed", request_records: "received",
  lab_follow_up: "lab_checked", clinical_review: "plan_documented", admin_other: "done",
};

export function taskOutcomeChoices(category: TaskCategory) {
  const keys: OutcomeChoice[] = [COMPLETION[category], ...(category === "clinical_review" ? [] : ["attempted" as const]), "waiting", "review"];
  return keys.map((value) => ({ value, ...CHOICES[value] }));
}

/** Called with the stored category on the server; clients cannot select an unrelated outcome. */
export function resolveTaskOutcome(category: TaskCategory, choice: string, note: string) {
  const selected = taskOutcomeChoices(category).find((item) => item.value === choice);
  if (!selected) return null;
  return { status: selected.status, outcome: `${selected.label}${note.trim() ? ` — ${note.trim()}` : ""}` };
}
