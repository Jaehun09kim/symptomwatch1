import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { detectionFlags, labOrders, patients, referrals, tasks } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import type { TaskCategory } from "@/lib/labels";
import type { RuleId } from "@/lib/detection/types";

export interface DashboardSummary {
  totalPatients: number;
  openTasks: number;
  overdueAdminTasks: number;
  pendingRecords: number;
  completedThisWeek: number;
  /** null = viewer lacks clinical access. */
  patientsNeedingReview: number | null;
  pendingLabs: number | null;
  weekly: Array<{ weekStart: string; opened: number; completed: number }>;
  openByCategory: Array<{ category: TaskCategory; count: number }>;
  openFlagsByRule: Array<{ ruleId: RuleId; count: number }> | null;
}

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeekUtc(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const weekday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - weekday * DAY);
}

export async function getDashboardSummary(ctx: AppContext, now = new Date(), database?: DatabaseHandle): Promise<DashboardSummary> {
  const clinical = can(ctx.role, "patient.read_clinical");
  const flags = can(ctx.role, "flag.read");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const weekStart = startOfWeekUtc(now);
  const firstWeek = new Date(weekStart.getTime() - 7 * 7 * DAY);

  return withTenant(ctx, async (tx) => {
    const count = sql<number>`count(*)::int`;
    const [{ value: totalPatients }] = await tx.select({ value: count }).from(patients).where(eq(patients.clinicId, ctx.clinicId));
    const [{ value: openTasks }] = await tx.select({ value: count }).from(tasks)
      .where(and(eq(tasks.clinicId, ctx.clinicId), ne(tasks.status, "completed")));
    const [{ value: overdueAdminTasks }] = await tx.select({ value: count }).from(tasks)
      .where(and(eq(tasks.clinicId, ctx.clinicId), ne(tasks.status, "completed"), ne(tasks.category, "clinical_review"), sql`${tasks.dueDate} < ${today}`));
    const [{ value: pendingRecords }] = await tx.select({ value: count }).from(referrals)
      .innerJoin(patients, eq(patients.id, referrals.patientId))
      .where(and(eq(referrals.clinicId, ctx.clinicId), inArray(referrals.status, ["sent", "scheduled", "seen"]), eq(patients.careStatus, "active")));
    const [{ value: completedThisWeek }] = await tx.select({ value: count }).from(tasks)
      .where(and(eq(tasks.clinicId, ctx.clinicId), eq(tasks.status, "completed"), gte(tasks.completedAt, weekStart.toISOString())));

    let pendingLabs: number | null = null;
    if (clinical) {
      [{ value: pendingLabs }] = await tx.select({ value: count }).from(labOrders)
        .innerJoin(patients, eq(patients.id, labOrders.patientId))
        .where(and(eq(labOrders.clinicId, ctx.clinicId), inArray(labOrders.status, ["ordered", "collected"]), eq(patients.careStatus, "active")));
    }
    let patientsNeedingReview: number | null = null;
    let openFlagsByRule: DashboardSummary["openFlagsByRule"] = null;
    if (flags) {
      // Snoozed flags are parked until their date; they don't need attention today.
      const awaitingReview = and(
        eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.status, "open"),
        or(isNull(detectionFlags.snoozedUntil), lte(detectionFlags.snoozedUntil, sql`now()`)),
      );
      [{ value: patientsNeedingReview }] = await tx.select({ value: sql<number>`count(distinct ${detectionFlags.patientId})::int` })
        .from(detectionFlags).where(awaitingReview);
      openFlagsByRule = await tx.select({ ruleId: detectionFlags.ruleId, count })
        .from(detectionFlags)
        .where(awaitingReview)
        .groupBy(detectionFlags.ruleId);
    }

    const openByCategory = await tx.select({ category: tasks.category, count })
      .from(tasks)
      .where(and(eq(tasks.clinicId, ctx.clinicId), ne(tasks.status, "completed")))
      .groupBy(tasks.category);

    const opened = await tx.select({ week: sql<string>`date_trunc('week', ${tasks.createdAt} at time zone 'UTC')::date::text`, count })
      .from(tasks).where(and(eq(tasks.clinicId, ctx.clinicId), gte(tasks.createdAt, firstWeek.toISOString()))).groupBy(sql`1`);
    const completed = await tx.select({ week: sql<string>`date_trunc('week', ${tasks.completedAt} at time zone 'UTC')::date::text`, count })
      .from(tasks).where(and(eq(tasks.clinicId, ctx.clinicId), gte(tasks.completedAt, firstWeek.toISOString()))).groupBy(sql`1`);
    const weekly = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(firstWeek.getTime() + index * 7 * DAY).toISOString().slice(0, 10);
      return {
        weekStart: start,
        opened: opened.find((row) => row.week === start)?.count ?? 0,
        completed: completed.find((row) => row.week === start)?.count ?? 0,
      };
    });

    return {
      totalPatients,
      openTasks,
      overdueAdminTasks,
      pendingRecords,
      completedThisWeek,
      patientsNeedingReview,
      pendingLabs,
      weekly,
      openByCategory,
      openFlagsByRule,
    };
  }, database);
}
