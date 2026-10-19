import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { patients, tasks, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import type { TaskCategory, TaskStatus } from "@/lib/labels";
import { TASK_VIEWS, type DueWindow, type TaskView } from "@/lib/queue-filters";
import { resolveTaskOutcome } from "@/lib/task-outcomes";
import { checkFreeText, describePhiFailure } from "@/lib/validation/phi-guard";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";
import { assertAssignable } from "./members";

export { TASK_VIEWS, type DueWindow, type TaskView } from "@/lib/queue-filters";

export interface TaskQuery {
  view?: TaskView;
  status?: TaskStatus | "open" | "any";
  assignee?: "me" | "unassigned" | string;
  due?: DueWindow;
  patientId?: string;
  taskId?: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  dueDate: string;
  outcome: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patientId: string | null;
  patientName: string | null;
  patientMrn: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  sourceFlagId: string | null;
}

/** UTC midnight of "today" — due dates are compared at day granularity. */
function startOfTodayUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function listTasks(ctx: AppContext, query: TaskQuery = {}, database?: DatabaseHandle): Promise<TaskRow[]> {
  return withTenant(ctx, async (tx) => {
    const filters: SQL[] = [eq(tasks.clinicId, ctx.clinicId)];
    const categories = TASK_VIEWS[query.view ?? "all"];
    if (categories) filters.push(inArray(tasks.category, [...categories]));
    const status = query.status ?? "open";
    if (status === "open") filters.push(ne(tasks.status, "completed"));
    else if (status !== "any") filters.push(eq(tasks.status, status));
    if (query.assignee === "me") filters.push(eq(tasks.assigneeId, ctx.userId));
    else if (query.assignee === "unassigned") filters.push(isNull(tasks.assigneeId));
    else if (query.assignee) filters.push(eq(tasks.assigneeId, query.assignee));
    if (query.patientId) filters.push(eq(tasks.patientId, query.patientId));
    if (query.taskId) filters.push(eq(tasks.id, query.taskId));
    const today = startOfTodayUtc();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    if (query.due === "overdue") filters.push(sql`${tasks.dueDate} < ${today.toISOString()}`);
    if (query.due === "today") filters.push(sql`${tasks.dueDate} >= ${today.toISOString()} and ${tasks.dueDate} < ${tomorrow.toISOString()}`);
    if (query.due === "week") filters.push(sql`${tasks.dueDate} < ${new Date(today.getTime() + 8 * 86_400_000).toISOString()}`);

    return tx
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        category: tasks.category,
        status: tasks.status,
        dueDate: tasks.dueDate,
        outcome: tasks.outcome,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        patientId: tasks.patientId,
        patientName: sql<string | null>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientMrn: patients.demoMrn,
        assigneeId: tasks.assigneeId,
        assigneeName: users.displayName,
        sourceFlagId: tasks.sourceFlagId,
      })
      .from(tasks)
      .leftJoin(patients, eq(patients.id, tasks.patientId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(...filters))
      .orderBy(
        sql`case when ${tasks.status} = 'completed' then 1 else 0 end`,
        asc(tasks.dueDate),
        desc(tasks.createdAt),
      )
      .limit(200);
  }, database);
}

const text = (max: number) => z.string().trim().max(max);

export const createTaskSchema = z.object({
  title: text(160).min(3, "Give the task a short title"),
  description: text(1000).optional().default(""),
  category: z.enum(["call_patient", "confirm_appointment", "request_records", "lab_follow_up", "admin_other", "clinical_review"]),
  patientId: z.uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  assigneeId: z.uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  dueDate: z.iso.date("Choose a due date"),
});

export const updateTaskSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(["pending", "in_progress", "completed", "needs_review"]).optional(),
  assigneeId: z.uuid().or(z.literal("")).optional(),
  outcome: text(1000).optional(),
  dueDate: z.iso.date().optional(),
  outcomeChoice: text(40).min(1, "Choose an outcome").optional(),
  outcomeNote: text(900).optional(),
});

function assertNoPhi(fields: Array<[string, string | undefined]>): void {
  for (const [label, value] of fields) {
    if (!value) continue;
    const check = checkFreeText(value);
    if (!check.ok) throw new ServiceError(describePhiFailure(label, check));
  }
}

function assertCategoryAllowed(ctx: AppContext, category: TaskCategory): void {
  if (!can(ctx.role, "task.manage")) throw new ServiceError("You don't have permission to manage tasks.");
  if (category === "clinical_review" && !can(ctx.role, "task.manage_clinical")) {
    throw new ServiceError("Only physicians can create or edit clinical review tasks.");
  }
}

/** Due dates are stored at 16:00 UTC (morning in California) of the chosen calendar day. */
const dueAt = (date: string) => `${date}T16:00:00.000Z`;

export async function createTask(ctx: AppContext, raw: z.input<typeof createTaskSchema>, database?: DatabaseHandle): Promise<string> {
  const input = createTaskSchema.parse(raw);
  assertCategoryAllowed(ctx, input.category);
  assertNoPhi([["Title", input.title], ["Description", input.description]]);
  return withTenant(ctx, async (tx) => {
    if (input.patientId) {
      const [patient] = await tx.select({ id: patients.id }).from(patients)
        .where(and(eq(patients.clinicId, ctx.clinicId), eq(patients.id, input.patientId)));
      if (!patient) throw new ServiceError("Patient not found.");
    }
    if (input.assigneeId) await assertAssignable(tx, ctx, input.assigneeId, input.category);
    const [row] = await tx.insert(tasks).values({
      clinicId: ctx.clinicId,
      patientId: input.patientId ?? null,
      category: input.category,
      title: input.title,
      description: input.description || null,
      assigneeId: input.assigneeId ?? null,
      createdBy: ctx.userId,
      dueDate: dueAt(input.dueDate),
    }).returning({ id: tasks.id });
    await recordAudit(tx, ctx, "task.created", { type: "task", id: row.id }, {
      category: input.category,
      assigned: Boolean(input.assigneeId),
    });
    return row.id;
  }, database);
}

export async function updateTask(ctx: AppContext, raw: z.input<typeof updateTaskSchema>, database?: DatabaseHandle): Promise<void> {
  const input = updateTaskSchema.parse(raw);
  assertNoPhi([["Outcome", input.outcome]]);
  await withTenant(ctx, async (tx) => {
    const [task] = await tx.select().from(tasks).where(and(eq(tasks.clinicId, ctx.clinicId), eq(tasks.id, input.taskId)));
    if (!task) throw new ServiceError("Task not found.");
    assertCategoryAllowed(ctx, task.category);
    if (input.outcomeChoice !== undefined) {
      const result = resolveTaskOutcome(task.category, input.outcomeChoice, input.outcomeNote ?? "");
      if (!result) throw new ServiceError("Choose an outcome for this task type.");
      assertNoPhi([["Outcome note", input.outcomeNote]]);
      input.status = result.status;
      input.outcome = result.outcome;
    }

    const changes: Partial<typeof tasks.$inferInsert> = { updatedAt: sql`now()` as unknown as string };
    const audit: Record<string, unknown> = {};
    if (input.assigneeId !== undefined && (input.assigneeId || null) !== task.assigneeId) {
      if (input.assigneeId) await assertAssignable(tx, ctx, input.assigneeId, task.category);
      changes.assigneeId = input.assigneeId || null;
      audit.assigned = Boolean(input.assigneeId);
    }
    if (input.dueDate) {
      changes.dueDate = dueAt(input.dueDate);
      audit.dueDateChanged = true;
    }
    const outcome = input.outcome ?? task.outcome ?? "";
    if (input.outcome !== undefined) {
      changes.outcome = input.outcome || null;
      audit.outcomeRecorded = Boolean(input.outcome);
    }
    if (input.status && input.status !== task.status) {
      if (input.status === "completed" && !outcome.trim()) {
        throw new ServiceError("Record an outcome before marking the task completed.");
      }
      changes.status = input.status;
      changes.completedAt = input.status === "completed" ? (sql`now()` as unknown as string) : null;
      audit.from = task.status;
      audit.to = input.status;
    }
    await tx.update(tasks).set(changes).where(and(eq(tasks.clinicId, ctx.clinicId), eq(tasks.id, task.id)));
    const action = "to" in audit ? "task.status_changed" : "assigned" in audit ? "task.assigned" : "task.updated";
    await recordAudit(tx, ctx, action, { type: "task", id: task.id }, audit);
  }, database);
}
