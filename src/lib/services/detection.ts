import { and, asc, desc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { detectionFlags, detectionRuns, flagEvents, flagFeedback, patients, tasks, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { applyDetectionRun, type DetectionRunSummary } from "@/lib/detection/persistence";
import type { RuleId } from "@/lib/detection/types";
import { getEnv } from "@/lib/env";
import { dismissReasonShortLabel, type DismissReason, type FlagStatus } from "@/lib/labels";
import { RULE_IDS } from "@/lib/detection/clinic-config";
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
  reviewReason: DismissReason | null;
  snoozedUntil: string | null;
  snoozeNote: string | null;
  snoozedByName: string | null;
}

export interface FlagQuery {
  /** `open` excludes snoozed flags; `snoozed` lists open flags whose snooze hasn't ended. */
  status?: FlagStatus | "snoozed" | "all";
  ruleId?: RuleId;
  physicianId?: string;
}

/** Review queue — ordered by first detection date, never by any notion of urgency. */
export async function listFlags(ctx: AppContext, query: FlagQuery = {}, database?: DatabaseHandle): Promise<FlagListItem[]> {
  require(ctx, "flag.read");
  return withTenant(ctx, async (tx) => {
    const filters: SQL[] = [eq(detectionFlags.clinicId, ctx.clinicId)];
    const status = query.status ?? "open";
    const now = sql`now()`;
    if (status === "open") filters.push(eq(detectionFlags.status, "open"), or(isNull(detectionFlags.snoozedUntil), lte(detectionFlags.snoozedUntil, now))!);
    else if (status === "snoozed") filters.push(eq(detectionFlags.status, "open"), gt(detectionFlags.snoozedUntil, now));
    else if (status !== "all") filters.push(eq(detectionFlags.status, status));
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
        reviewReason: detectionFlags.reviewReason,
        snoozedUntil: detectionFlags.snoozedUntil,
        snoozeNote: detectionFlags.snoozeNote,
        snoozedByName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${detectionFlags.snoozedBy})`,
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
        .set({ status: "confirmed", reviewedBy: ctx.userId, reviewedAt: sql`now()` as unknown as string, reviewNote: input.note || null, ...CLEAR_SNOOZE })
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

const CLEAR_SNOOZE = { snoozedUntil: null, snoozedBy: null, snoozeNote: null };

export const dismissFlagSchema = z.object({
  flagId: z.uuid(),
  reasonCode: z.enum(["expected", "addressed_elsewhere", "not_clinically_relevant", "data_error", "other"]).default("other"),
  reason: z.string().trim().max(500).optional().default(""),
}).refine((input) => input.reasonCode !== "other" || input.reason.length >= 3, {
  path: ["reason"],
  message: "Give a short reason for dismissing",
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
      .set({ status: "dismissed", reviewedBy: ctx.userId, reviewedAt: sql`now()` as unknown as string, reviewNote: input.reason || null, reviewReason: input.reasonCode, ...CLEAR_SNOOZE })
      .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flag.id)));
    const note = `${dismissReasonShortLabel[input.reasonCode]}${input.reason ? ` — ${input.reason}` : ""}`;
    await tx.insert(flagEvents).values({ clinicId: ctx.clinicId, flagId: flag.id, eventType: "dismissed", actorUserId: ctx.userId, note });
    await recordAudit(tx, ctx, "flag.dismissed", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId, reasonCode: input.reasonCode });
  }, database);
}

export const MAX_SNOOZE_DAYS = 90;
const DAY_MS = 86_400_000;

export const snoozeFlagSchema = z.object({
  flagId: z.uuid(),
  until: z.iso.date("Choose a date"),
  note: z.string().trim().max(300).optional().default(""),
});

/** Hides an open flag from the review queue until a date. New evidence wakes it early. */
export async function snoozeFlag(ctx: AppContext, raw: z.input<typeof snoozeFlagSchema>, database?: DatabaseHandle): Promise<void> {
  require(ctx, "flag.review");
  const input = snoozeFlagSchema.parse(raw);
  assertNoPhi("Note", input.note);
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const days = (Date.parse(input.until) - today) / DAY_MS;
  if (days < 1) throw new ServiceError("Choose a date in the future.");
  if (days > MAX_SNOOZE_DAYS) throw new ServiceError(`Snooze for ${MAX_SNOOZE_DAYS} days or less.`);
  await withTenant(ctx, async (tx) => {
    const [flag] = await tx.select().from(detectionFlags).where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, input.flagId)));
    if (!flag) throw new ServiceError("Flag not found.");
    if (flag.status !== "open") throw new ServiceError("Only flags awaiting review can be snoozed.");
    const until = `${input.until}T16:00:00.000Z`;
    await tx.update(detectionFlags)
      .set({ snoozedUntil: until, snoozedBy: ctx.userId, snoozeNote: input.note || null })
      .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flag.id)));
    await tx.insert(flagEvents).values({
      clinicId: ctx.clinicId, flagId: flag.id, eventType: "snoozed", actorUserId: ctx.userId,
      note: `Until ${input.until}${input.note ? ` — ${input.note}` : ""}`,
    });
    await recordAudit(tx, ctx, "flag.snoozed", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId, days: Math.round(days) });
  }, database);
}

export async function unsnoozeFlag(ctx: AppContext, raw: { flagId: string }, database?: DatabaseHandle): Promise<void> {
  require(ctx, "flag.review");
  const { flagId } = z.object({ flagId: z.uuid() }).parse(raw);
  await withTenant(ctx, async (tx) => {
    const [flag] = await tx.select().from(detectionFlags).where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flagId)));
    if (!flag) throw new ServiceError("Flag not found.");
    if (!flag.snoozedUntil) throw new ServiceError("This flag isn't snoozed.");
    await tx.update(detectionFlags).set(CLEAR_SNOOZE).where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.id, flag.id)));
    await tx.insert(flagEvents).values({ clinicId: ctx.clinicId, flagId: flag.id, eventType: "unsnoozed", actorUserId: ctx.userId, note: "Snooze ended early" });
    await recordAudit(tx, ctx, "flag.unsnoozed", { type: "detection_flag", id: flag.id }, { ruleId: flag.ruleId });
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

export interface RuleSignal {
  ruleId: RuleId;
  total: number;
  open: number;
  snoozed: number;
  confirmed: number;
  dismissed: number;
  resolved: number;
  suppressed: number;
  dismissReasons: Record<DismissReason, number>;
  /** Confirmed ÷ (confirmed + dismissed); null until a physician has reviewed one. */
  confirmRate: number | null;
}

/** Per-rule outcomes: how often physicians confirm vs. dismiss, and why. Counts, not urgency. */
export async function signalQuality(ctx: AppContext, database?: DatabaseHandle): Promise<RuleSignal[]> {
  require(ctx, "flag.read");
  const rows = await withTenant(ctx, (tx) => tx
    .select({
      ruleId: detectionFlags.ruleId,
      status: detectionFlags.status,
      reason: detectionFlags.reviewReason,
      snoozed: sql<boolean>`(${detectionFlags.snoozedUntil} is not null and ${detectionFlags.snoozedUntil} > now())`,
      count: sql<number>`count(*)::int`,
    })
    .from(detectionFlags)
    .where(eq(detectionFlags.clinicId, ctx.clinicId))
    .groupBy(detectionFlags.ruleId, detectionFlags.status, detectionFlags.reviewReason, sql`4`), database);
  return RULE_IDS.map((ruleId) => {
    const signal: RuleSignal = {
      ruleId, total: 0, open: 0, snoozed: 0, confirmed: 0, dismissed: 0, resolved: 0, suppressed: 0,
      dismissReasons: { expected: 0, addressed_elsewhere: 0, not_clinically_relevant: 0, data_error: 0, other: 0 },
      confirmRate: null,
    };
    for (const row of rows.filter((item) => item.ruleId === ruleId)) {
      signal.total += row.count;
      if (row.status === "open") signal[row.snoozed ? "snoozed" : "open"] += row.count;
      else if (row.status === "confirmed") signal.confirmed += row.count;
      else if (row.status === "dismissed") {
        signal.dismissed += row.count;
        signal.dismissReasons[row.reason ?? "other"] += row.count;
      } else if (row.status === "resolved_by_data") signal.resolved += row.count;
      else signal.suppressed += row.count;
    }
    const reviewed = signal.confirmed + signal.dismissed;
    signal.confirmRate = reviewed ? signal.confirmed / reviewed : null;
    return signal;
  });
}
