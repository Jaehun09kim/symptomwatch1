import type { TaskCategory, TaskStatus } from "@/lib/labels";

export const TASK_VIEWS = {
  all: null,
  admin: ["call_patient", "confirm_appointment", "request_records", "lab_follow_up", "admin_other"],
  calls: ["call_patient"],
  confirmations: ["confirm_appointment"],
  records: ["request_records"],
  other: ["lab_follow_up", "admin_other"],
  clinical: ["clinical_review"],
} as const satisfies Record<string, readonly TaskCategory[] | null>;
export type TaskView = keyof typeof TASK_VIEWS;
export type DueWindow = "all" | "overdue" | "today" | "week";
export type QueueParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const STATUSES = new Set(["open", "any", "pending", "in_progress", "completed", "needs_review"]);
const DUES = new Set(["all", "overdue", "today", "week"]);

export function parseQueueFilters(params: QueueParams, canReadClinical: boolean) {
  const view = one(params.view) ?? "all";
  const status = one(params.status) ?? "open";
  const due = one(params.due) ?? "all";
  const assignee = one(params.assignee);
  const task = one(params.task);
  return {
    view: Object.hasOwn(TASK_VIEWS, view) && (view !== "clinical" || canReadClinical) ? view as TaskView : "all" as const,
    status: (STATUSES.has(status) ? status : "open") as TaskStatus | "open" | "any",
    due: (DUES.has(due) ? due : "all") as DueWindow,
    assignee: assignee && (assignee === "me" || assignee === "unassigned" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignee)) ? assignee : undefined,
    taskId: task && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task) ? task : undefined,
  };
}

export const QUEUE_QUICK_VIEWS = { mine: "Mine", today: "Due today", overdue: "Overdue", unassigned: "Unassigned" } as const;
export type QueueQuickView = keyof typeof QUEUE_QUICK_VIEWS;

/** Each shortcut is a complete open-work view; stale filters cannot hide its work. */
export function queueQuickViewParams(view: QueueQuickView): URLSearchParams {
  return new URLSearchParams(view === "mine" ? { assignee: "me" } : view === "unassigned" ? { assignee: "unassigned" } : { due: view });
}

export function activeQueueQuickView(params: QueueParams): QueueQuickView | undefined {
  const filters = parseQueueFilters(params, true);
  if (filters.status !== "open" || filters.view !== "all" || filters.taskId) return;
  if (filters.due === "all") {
    if (filters.assignee === "me") return "mine";
    if (filters.assignee === "unassigned") return "unassigned";
  }
  if (!filters.assignee && (filters.due === "today" || filters.due === "overdue")) return filters.due;
}

export function hasQueueFilters(filters: ReturnType<typeof parseQueueFilters>) {
  return filters.view !== "all" || filters.status !== "open" || filters.due !== "all" || Boolean(filters.assignee || filters.taskId);
}
