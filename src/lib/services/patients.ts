import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import {
  appointments,
  detectionFlags,
  encounters,
  labOrders,
  patients,
  referrals,
  symptomObservations,
  tasks,
  users,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";

export const PATIENT_PAGE_SIZE = 12;

export type PatientStatusFilter = "all" | "needs_review" | "open_tasks" | "clear";
export type PatientSort = "name" | "mrn" | "open_tasks" | "flags" | "next_due";

export interface PatientListQuery {
  q?: string;
  status?: PatientStatusFilter;
  physicianId?: string;
  sort?: PatientSort;
  page?: number;
}

export interface PatientRow {
  id: string;
  demoMrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: "female" | "male";
  careStatus: "active" | "transferred_out";
  physicianName: string | null;
  openTasks: number;
  nextDue: string | null;
  /** null when the viewer may not see clinical flags. */
  openFlags: number | null;
}

export async function listPatients(
  ctx: AppContext,
  query: PatientListQuery = {},
  database?: DatabaseHandle,
): Promise<{ rows: PatientRow[]; total: number; page: number; pageSize: number }> {
  const clinical = can(ctx.role, "flag.read");
  return withTenant(ctx, async (tx) => {
    // RLS hides clinical-review tasks from front-desk staff, so these counts are already role-correct.
    const openTasks = sql<number>`(select count(*)::int from ${tasks} t where t.patient_id = ${patients.id} and t.status <> 'completed')`;
    const nextDue = sql<string | null>`(select min(t.due_date) from ${tasks} t where t.patient_id = ${patients.id} and t.status <> 'completed')`;
    const openFlags = clinical
      ? sql<number>`(select count(*)::int from ${detectionFlags} f where f.patient_id = ${patients.id} and f.status in ('open', 'confirmed'))`
      : sql<null>`null`;

    const filters: SQL[] = [eq(patients.clinicId, ctx.clinicId)];
    const q = query.q?.trim();
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
      filters.push(sql`(${patients.firstName} || ' ' || ${patients.lastName} ILIKE ${like} OR ${patients.demoMrn} ILIKE ${like})`);
    }
    if (query.physicianId) filters.push(eq(patients.primaryPhysicianId, query.physicianId));
    const status = query.status ?? "all";
    if (status === "needs_review" && clinical) filters.push(sql`${openFlags} > 0`);
    if (status === "open_tasks") filters.push(sql`${openTasks} > 0`);
    if (status === "clear") filters.push(clinical ? sql`${openTasks} = 0 and ${openFlags} = 0` : sql`${openTasks} = 0`);

    const order = {
      name: [asc(patients.lastName), asc(patients.firstName)],
      mrn: [asc(patients.demoMrn)],
      open_tasks: [desc(openTasks), asc(patients.lastName)],
      flags: clinical ? [desc(openFlags), asc(patients.lastName)] : [asc(patients.lastName)],
      next_due: [sql`${nextDue} asc nulls last`, asc(patients.lastName)],
    }[query.sort ?? "name"];

    const page = Math.max(1, query.page ?? 1);
    const where = and(...filters);
    const rows = await tx
      .select({
        id: patients.id,
        demoMrn: patients.demoMrn,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dateOfBirth: patients.dateOfBirth,
        sex: patients.sex,
        careStatus: patients.careStatus,
        physicianName: users.displayName,
        openTasks,
        nextDue,
        openFlags,
      })
      .from(patients)
      .leftJoin(users, eq(users.id, patients.primaryPhysicianId))
      .where(where)
      .orderBy(...order)
      .limit(PATIENT_PAGE_SIZE)
      .offset((page - 1) * PATIENT_PAGE_SIZE);
    const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(patients).where(where);
    return { rows, total, page, pageSize: PATIENT_PAGE_SIZE };
  }, database);
}

export interface PatientHeader {
  id: string;
  demoMrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: "female" | "male";
  phone: string;
  careStatus: "active" | "transferred_out";
  physicianName: string | null;
}

async function loadHeader(tx: DbTransaction, ctx: AppContext, patientId: string): Promise<PatientHeader> {
  const [row] = await tx
    .select({
      id: patients.id,
      demoMrn: patients.demoMrn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      sex: patients.sex,
      phone: patients.phone,
      careStatus: patients.careStatus,
      physicianName: users.displayName,
    })
    .from(patients)
    .leftJoin(users, eq(users.id, patients.primaryPhysicianId))
    .where(and(eq(patients.clinicId, ctx.clinicId), eq(patients.id, patientId)));
  if (!row) throw new ServiceError("Patient not found.");
  return row;
}

/** Raw, role-filtered record set for one patient. Front-desk staff never receive clinical rows or fields. */
export interface PatientRecord {
  header: PatientHeader;
  clinical: boolean;
  encounters: Array<typeof encounters.$inferSelect & { providerName: string | null }>;
  symptoms: Array<typeof symptomObservations.$inferSelect>;
  labs: Array<typeof labOrders.$inferSelect>;
  referrals: Array<{
    id: string;
    specialty: string;
    status: (typeof referrals.$inferSelect)["status"];
    referredAt: string;
    expectedWithinDays: number;
    specialistAppointmentAt: string | null;
    recordsReceivedAt: string | null;
    statusReason: string | null;
    /** Clinical fields — null for front-desk staff. */
    reason: string | null;
    outcomeSummary: string | null;
  }>;
  appointments: Array<typeof appointments.$inferSelect>;
  tasks: Array<typeof tasks.$inferSelect & { assigneeName: string | null }>;
  flags: Array<typeof detectionFlags.$inferSelect & { isSnoozed: boolean }>;
}

const recentViews = new Map<string, number>();
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

/** Prefetches and re-renders shouldn't inflate access logs: one entry per user/patient per 10 minutes. */
function shouldAuditView(ctx: AppContext, patientId: string): boolean {
  const key = `${ctx.actorUserId}:${ctx.userId}:${patientId}`;
  const now = Date.now();
  const last = recentViews.get(key);
  if (last && now - last < VIEW_DEDUPE_MS) return false;
  recentViews.set(key, now);
  if (recentViews.size > 5_000) {
    for (const [entry, time] of recentViews) if (now - time > VIEW_DEDUPE_MS) recentViews.delete(entry);
  }
  return true;
}

export async function getPatientRecord(
  ctx: AppContext,
  patientId: string,
  options: { audit?: boolean } = {},
  database?: DatabaseHandle,
): Promise<PatientRecord> {
  const clinical = can(ctx.role, "patient.read_clinical");
  return withTenant(ctx, async (tx) => {
    const header = await loadHeader(tx, ctx, patientId);
    const scope = and(eq(appointments.clinicId, ctx.clinicId), eq(appointments.patientId, patientId));
    const appointmentRows = await tx.select().from(appointments).where(scope).orderBy(asc(appointments.scheduledFor));
    const taskRows = await tx
      .select({ task: tasks, assigneeName: users.displayName })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.clinicId, ctx.clinicId), eq(tasks.patientId, patientId)))
      .orderBy(asc(tasks.createdAt));
    const referralRows = await tx
      .select()
      .from(referrals)
      .where(and(eq(referrals.clinicId, ctx.clinicId), eq(referrals.patientId, patientId)))
      .orderBy(asc(referrals.referredAt));

    let encounterRows: PatientRecord["encounters"] = [];
    let symptomRows: PatientRecord["symptoms"] = [];
    let labRows: PatientRecord["labs"] = [];
    let flagRows: PatientRecord["flags"] = [];
    if (clinical) {
      encounterRows = (await tx
        .select({ encounter: encounters, providerName: users.displayName })
        .from(encounters)
        .leftJoin(users, eq(users.id, encounters.providerId))
        .where(and(eq(encounters.clinicId, ctx.clinicId), eq(encounters.patientId, patientId)))
        .orderBy(asc(encounters.occurredAt))).map((row) => ({ ...row.encounter, providerName: row.providerName }));
      symptomRows = await tx.select().from(symptomObservations)
        .where(and(eq(symptomObservations.clinicId, ctx.clinicId), eq(symptomObservations.patientId, patientId)))
        .orderBy(asc(symptomObservations.observedAt));
      labRows = await tx.select().from(labOrders)
        .where(and(eq(labOrders.clinicId, ctx.clinicId), eq(labOrders.patientId, patientId)))
        .orderBy(asc(labOrders.orderedAt));
      const now = Date.now();
      flagRows = (await tx.select().from(detectionFlags)
        .where(and(eq(detectionFlags.clinicId, ctx.clinicId), eq(detectionFlags.patientId, patientId)))
        .orderBy(desc(detectionFlags.firstDetectedAt)))
        .map((flag) => ({ ...flag, isSnoozed: flag.status === "open" && flag.snoozedUntil !== null && Date.parse(flag.snoozedUntil) > now }));
    }

    if (options.audit && shouldAuditView(ctx, patientId)) {
      await recordAudit(tx, ctx, "patient.timeline_viewed", { type: "patient", id: patientId }, { clinical });
    }

    return {
      header,
      clinical,
      encounters: encounterRows,
      symptoms: symptomRows,
      labs: labRows,
      referrals: referralRows.map((row) => ({
        id: row.id,
        specialty: row.specialty,
        status: row.status,
        referredAt: row.referredAt,
        expectedWithinDays: row.expectedWithinDays,
        specialistAppointmentAt: row.specialistAppointmentAt,
        recordsReceivedAt: row.recordsReceivedAt,
        statusReason: row.statusReason,
        reason: clinical ? row.reason : null,
        outcomeSummary: clinical ? row.outcomeSummary : null,
      })),
      appointments: appointmentRows,
      tasks: taskRows.map((row) => ({ ...row.task, assigneeName: row.assigneeName })),
      flags: flagRows,
    };
  }, database);
}

/** Lightweight lookup for task forms. */
export async function listPatientOptions(ctx: AppContext, database?: DatabaseHandle): Promise<Array<{ id: string; label: string }>> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, demoMrn: patients.demoMrn })
      .from(patients)
      .where(eq(patients.clinicId, ctx.clinicId))
      .orderBy(asc(patients.lastName), asc(patients.firstName));
    return rows.map((row) => ({ id: row.id, label: `${row.lastName}, ${row.firstName} · ${row.demoMrn}` }));
  }, database);
}
