import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { detectionFlags, detectionRuns, flagEvents, flagFeedback, patients, tasks, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { applyDetectionRun, type DetectionRunSummary } from "@/lib/detection/persistence";
import type { RuleId } from "@/lib/detection/types";
import { getEnv } from "@/lib/env";
import type { FlagStatus } from "@/lib/labels";
import { checkFreeText, describePhiFailure } from "@/lib/validation/phi-guard";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";
import { assertAssignable } from "./members";

function require(ctx: AppContext, permission: "detection.run" | "flag.read" | "flag.review"): void {
  if (!can(ctx.role, permission)) {
    throw new ServiceError(permission === "flag.review" ? "Only physicians can review flags." : "You don't have access to detection results.");
  }
}

function assertNoPhi(label: string, value: string | undefined): void {
  if (!value) return;
  const check = checkFreeText(value, { maxLength: 1000 });
  if (!check.ok) throw new ServiceError(describePhiFailure(label, check));
}

export async function runDetectionForClinic(ctx: AppContext, database?: DatabaseHandle): Promise<DetectionRunSummary> {
  require(ctx, "detection.run");
  return withTenant(ctx, async (tx) => {
    const summary = await applyDetectionRun(tx, {
      clinicId: ctx.clinicId,
      actorUserId: ctx.userId,
      asOf: new Date(),
      externalAiEnabled: getEnv().EXTERNAL_AI_ENABLED,
    });
    await recordAudit(tx, ctx, "detection.run", { type: "clinic", id: ctx.clinicId }, { ...summary });
    return summary;
  }, database);
}

export interface FlagListItem {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  physicianName: string | null;
  ruleId: RuleId;
  ruleVersion: string;
  title: string;
  rationale: string;
  evidence: (typeof detectionFlags.$inferSelect)["evidence"];
  missingInfo: (typeof detectionFlags.$inferSelect)["missingInfo"];
  status: FlagStatus;
  firstDetectedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewerName: string | null;
}

export interface FlagQuery {
  status?: FlagStatus | "all";
  ruleId?: RuleId;
  physicianId?: string;
}

/** Review queue — ordered by first detection date, never by any notion of urgency. */
export async function listFlags(ctx: AppContext, query: FlagQuery = {}, database?: DatabaseHandle): Promise<FlagListItem[]> {
  require(ctx, "flag.read");
  return withTenant(ctx, async (tx) => {
    const filters: SQL[] = [eq(detectionFlags.clinicId, ctx.clinicId)];
    const status = query.status ?? "open";
    if (status !== "all") filters.push(eq(detectionFlags.status, status));
    if (query.ruleId) filters.push(eq(detectionFlags.ruleId, query.ruleId));
    if (query.physicianId) filters.push(eq(patients.primaryPhysicianId, query.physicianId));
    return tx
      .select({
        id: detectionFlags.id,
        patientId: detectionFlags.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientMrn: patients.demoMrn,
        physicianName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${patients.primaryPhysicianId})`,
        ruleId: detectionFlags.ruleId,
        ruleVersion: detectionFlags.ruleVersion,
        title: detectionFlags.title,
        rationale: detectionFlags.rationale,
        evidence: detectionFlags.evidence,
        missingInfo: detectionFlags.missingInfo,
        status: detectionFlags.status,
        firstDetectedAt: detectionFlags.firstDetectedAt,
        reviewedAt: detectionFlags.reviewedAt,
        reviewNote: detectionFlags.reviewNote,
        reviewerName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${detectionFlags.reviewedBy})`,
      })
      .from(detectionFlags)
      .innerJoin(patients, eq(patients.id, detectionFlags.patientId))
      .where(and(...filters))
      .orderBy(asc(detectionFlags.firstDetectedAt), asc(patients.lastName));
  }, database);
}

export async function getLastRun(ctx: AppContext, database?: DatabaseHandle) {
  require(ctx, "flag.read");
  return withTenant(ctx, async (tx) => {
    const [run] = await tx.select().from(detectionRuns).where(eq(detectionRuns.clinicId, ctx.clinicId)).orderBy(desc(detectionRuns.createdAt)).limit(1);
    return run ?? null;
  }, database);
}

export interface FlagHistoryEntry {
  eventType: string;
  createdAt: string;
  actorName: string | null;
  note: string | null;
}

export async function getFlagHistory(ctx: AppContext, flagIds: string[], database?: DatabaseHandle): Promise<Record<string, FlagHistoryEntry[]>> {
  require(ctx, "flag.read");
  if (!flagIds.length) return {};
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        flagId: flagEvents.flagId,
        eventType: flagEvents.eventType,
        createdAt: flagEvents.createdAt,
        note: flagEvents.note,
        actorName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${flagEvents.actorUserId})`,
      })
      .from(flagEvents)
      .where(and(eq(flagEvents.clinicId, ctx.clinicId), inArray(flagEvents.flagId, flagIds)))
      .orderBy(asc(flagEvents.createdAt));
    const history: Record<string, FlagHistoryEntry[]> = {};
    for (const row of rows) (history[row.flagId] ??= []).push(row);
    return history;
  }, database);
}

export const confirmFlagSchema = z.object({
  flagId: z.uuid(),
  note: z.string().trim().max(500).optional().default(""),
  createTask: z.boolean().default(false),
  taskTitle: z.string().trim().max(160).optional().default(""),
  taskCategory: z.enum(["call_patient", "confirm_appointment", "request_records", "lab_follow_up", "admin_other", "clinical_review"]).default("clinical_review"),
  assigneeId: z.uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  dueDate: z.iso.date().optional().or(z.literal("")).transform((value) => value || undefined),
});

/** Physician confirms the documentation gap; optionally creates one follow-up task atomically. */
export async function confirmFlag(ctx: AppContext, raw: z.input<typeof confirmFlagSchema>, database?: DatabaseHandle): Promise<void> {
  require(ctx, "flag.review");
  const input = confirmFlagSchema.parse(raw);
  assertNoPhi("Note", input.note);
  assertNoPhi("Task title", input.taskTitle);
  await withTenant(ctx, async (tx) => {
    const [flag] = await tx.select().from(detectionFlags).where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, input.flagId)));
    if (!flag) throw new ServiceError("Flag not found.");
    if (flag.status !== "open" && flag.status !== "confirmed") throw new ServiceError("Only open flags can be confirmed.");
    // Re-confirming keeps the original review; it only allows adding the follow-up task.
    if (flag.status === "open") {
      await tx.update(detectionFlags)
        .set({ status: "confirmed", reviewedBy: ctx.userId, reviewedAt: sql`now()` as unknown as string, reviewNote: input.note || null })
        .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flag.id)));
      await tx.insert(flagEvents).values({ clinicId: ctx.clinicId, flagId: flag.id, eventType: "confirmed", actorUserId: ctx.userId, note: input.note || null });
    }
    let taskId: string | null = null;
    if (input.createTask) {
      const [openTask] = await tx.select({ id: tasks.id }).from(tasks)
        .where(and(eq(tasks.clinicId, ctx.clinicId), eq(tasks.sourceFlagId, flag.id), ne(tasks.status, "completed")));
      if (!openTask) {
        if (input.assigneeId) await assertAssignable(tx, ctx, input.assigneeId, input.taskCategory);
        const due = input.dueDate ?? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        const [row] = await tx.insert(tasks).values({
          clinicId: ctx.clinicId,
          patientId: flag.patientId,
          category: input.taskCategory,
          title: input.taskTitle || `Follow up: ${flag.title}`.slice(0, 160),
          assigneeId: input.assigneeId ?? null,
          createdBy: ctx.userId,
          dueDate: `${due}T16:00:00.000Z`,
          sourceFlagId: flag.id,
        }).returning({ id: tasks.id });
        taskId = row.id;
        await recordAudit(tx, ctx, "task.created", { type: "task", id: row.id }, { category: input.taskCategory, fromFlag: true });
      }
    }
    await recordAudit(tx, ctx, "flag.confirmed", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId, taskCreated: Boolean(taskId) });
  }, database);
}

export const dismissFlagSchema = z.object({
  flagId: z.uuid(),
  reason: z.string().trim().min(3, "Give a short reason for dismissing").max(500),
});

export async function dismissFlag(ctx: AppContext, raw: z.input<typeof dismissFlagSchema>, database?: DatabaseHandle): Promise<void> {
  require(ctx, "flag.review");
  const input = dismissFlagSchema.parse(raw);
  assertNoPhi("Reason", input.reason);
  await withTenant(ctx, async (tx) => {
    const [flag] = await tx.select().from(detectionFlags).where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, input.flagId)));
    if (!flag) throw new ServiceError("Flag not found.");
    if (flag.status === "dismissed") throw new ServiceError("This flag is already dismissed.");
    await tx.update(detectionFlags)
      .set({ status: "dismissed", reviewedBy: ctx.userId, reviewedAt: sql`now()` as unknown as string, reviewNote: input.reason })
      .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flag.id)));
    await tx.insert(flagEvents).values({ clinicId: ctx.clinicId, flagId: flag.id, eventType: "dismissed", actorUserId: ctx.userId, note: input.reason });
    await recordAudit(tx, ctx, "flag.dismissed", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId });
  }, database);
}

export const feedbackSchema = z.object({
  flagId: z.uuid(),
  verdict: z.enum(["accurate", "false_positive", "already_addressed", "not_useful"]),
  comment: z.string().trim().max(500).optional().default(""),
});

export async function addFlagFeedback(ctx: AppContext, raw: z.input<typeof feedbackSchema>, database?: DatabaseHandle): Promise<void> {
  require(ctx, "flag.review");
  const input = feedbackSchema.parse(raw);
  assertNoPhi("Comment", input.comment);
  await withTenant(ctx, async (tx) => {
    const [flag] = await tx.select({ id: detectionFlags.id, ruleId: detectionFlags.ruleId }).from(detectionFlags)
      .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, input.flagId)));
    if (!flag) throw new ServiceError("Flag not found.");
    await tx.insert(flagFeedback).values({ clinicId: ctx.clinicId, flagId: flag.id, userId: ctx.userId, verdict: input.verdict, comment: input.comment || null });
    await tx.insert(flagEvents).values({ clinicId: ctx.clinicId, flagId: flag.id, eventType: "feedback", actorUserId: ctx.userId, note: `${input.verdict.replace("_", " ")}${input.comment ? ` — ${input.comment}` : ""}` });
    await recordAudit(tx, ctx, "flag.feedback", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId, verdict: input.verdict });
  }, database);
}

/** Aggregate clinician feedback per rule — the raw material for evaluating and improving rules. */
export async function feedbackSummary(ctx: AppContext, database?: DatabaseHandle) {
  require(ctx, "flag.read");
  return withTenant(ctx, (tx) => tx
    .select({ ruleId: detectionFlags.ruleId, verdict: flagFeedback.verdict, count: sql<number>`count(*)::int` })
    .from(flagFeedback)
    .innerJoin(detectionFlags, eq(detectionFlags.id, flagFeedback.flagId))
    .where(eq(flagFeedback.clinicId, ctx.clinicId))
    .groupBy(detectionFlags.ruleId, flagFeedback.verdict), database);
}
