import { describe, expect, it } from "vitest";
import { flagTaskDefaults } from "@/lib/flag-task-defaults";
import { activeQueueQuickView, hasQueueFilters, parseQueueFilters, queueQuickViewParams, type QueueQuickView } from "@/lib/queue-filters";
import { resolveTaskOutcome, taskOutcomeChoices } from "@/lib/task-outcomes";
import { appointmentOutcome } from "@/lib/timeline";

describe("rule-aware task defaults", () => {
  it.each([
    ["lab-result-missing", "lab_follow_up", "2026-10-22", "Check lab status"],
    ["referral-outcome-missing", "request_records", "2026-10-26", "Request specialist"],
    ["overdue-follow-up", "call_patient", "2026-10-21", "Call to rebook"],
    ["persistent-symptom-unresolved", "clinical_review", "2026-10-22", "Review recurring symptom"],
  ] as const)("%s gives an actionable task with a sensible owner", (rule, category, dueDate, action) => {
    const result = flagTaskDefaults(rule, "Fictional documentation gap", "reviewer-id", new Date("2026-10-19T23:59:00Z"), "front-desk-id");
    expect(result).toMatchObject({ category, dueDate, assigneeId: category === "clinical_review" ? "reviewer-id" : "front-desk-id" });
    expect(result.title).toContain(action);
    expect(result.title).toContain("Fictional documentation gap");
  });

  it("never hands front-desk work to the reviewing physician by default", () => {
    expect(flagTaskDefaults("overdue-follow-up", "x", "reviewer-id").assigneeId).toBe("");
    expect(flagTaskDefaults("persistent-symptom-unresolved", "x", "reviewer-id").assigneeId).toBe("reviewer-id");
  });

  it("caps the title and handles due dates across years", () => {
    const result = flagTaskDefaults("referral-outcome-missing", "x".repeat(200), "reviewer", new Date("2026-12-29"));
    expect(result.title).toHaveLength(160);
    expect(result.dueDate).toBe("2027-01-05");
  });
});

describe("queue quick views", () => {
  it.each([
    ["mine", { assignee: "me" }], ["today", { due: "today" }],
    ["overdue", { due: "overdue" }], ["unassigned", { assignee: "unassigned" }],
  ] as Array<[QueueQuickView, Record<string, string>]>)('%s uses existing parameters and selects open work', (view, expected) => {
    const params = Object.fromEntries(queueQuickViewParams(view));
    expect(params).toEqual(expected);
    expect(parseQueueFilters(params, false)).toMatchObject({ ...expected, status: "open", view: "all" });
    expect(activeQueueQuickView(params)).toBe(view);
    expect(hasQueueFilters(parseQueueFilters(params, false))).toBe(true);
  });

  it("does not mark a shortcut active for a narrower or completed set", () => {
    expect(activeQueueQuickView({ assignee: "me", due: "today" })).toBeUndefined();
    expect(activeQueueQuickView({ due: "today", status: "completed" })).toBeUndefined();
    expect(activeQueueQuickView({ assignee: "me", view: "records" })).toBeUndefined();
  });

  it("normalizes invalid filters and restricts the clinical view", () => {
    const filters = parseQueueFilters({ status: "invalid", due: ["today"], assignee: "not-a-uuid", view: "clinical", task: "not-a-uuid" }, false);
    expect(filters).toEqual({ status: "open", due: "all", assignee: undefined, view: "all", taskId: undefined });
    expect(hasQueueFilters(filters)).toBe(false);
    expect(parseQueueFilters({ view: "clinical" }, true).view).toBe("clinical");
    expect(parseQueueFilters({ view: "__proto__" }, true).view).toBe("all");
  });
});

describe("manual task outcomes", () => {
  it("keeps attempted contact and waiting work open", () => {
    expect(resolveTaskOutcome("call_patient", "attempted", " Retry tomorrow ")).toEqual({ status: "in_progress", outcome: "Attempted; try again — Retry tomorrow" });
    expect(resolveTaskOutcome("request_records", "waiting", "")?.status).toBe("in_progress");
  });
  it("records a meaningful outcome with no note and rejects unrelated choices", () => {
    expect(resolveTaskOutcome("request_records", "received", "")).toEqual({ status: "completed", outcome: "Records received" });
    expect(resolveTaskOutcome("call_patient", "plan_documented", "")).toBeNull();
    expect(resolveTaskOutcome("clinical_review", "attempted", "")).toBeNull();
    expect(taskOutcomeChoices("clinical_review")[0]).toMatchObject({ value: "plan_documented", status: "completed" });
  });
});

describe("appointment outcomes are independent of documentation", () => {
  it.each(["no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"] as const)("%s is not a successful outcome", (status) => {
    expect(appointmentOutcome(status).tone).toBe("attention");
  });
  it("only treats completion as complete", () => {
    expect(appointmentOutcome("completed")).toEqual({ label: "Completed", tone: "complete" });
    expect(appointmentOutcome("confirmed").tone).toBe("neutral");
    expect(appointmentOutcome("scheduled").tone).toBe("neutral");
  });
});
