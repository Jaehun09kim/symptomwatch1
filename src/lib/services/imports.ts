/**
 * CSV import of EHR report exports (lab orders, referrals) — the data on-ramp
 * that lets detection run on what a clinic already has instead of re-typed
 * records. Every import is previewed first; the commit re-validates on the
 * server, writes in one transaction with its batch and audit row, and refreshes
 * the affected patients' flags. Only this clinic's patients can be matched,
 * only demo MRNs are accepted, and statuses never move backwards.
 */
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { importBatches, labOrders, patients, referrals, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle, DbTransaction } from "@/lib/db/types";
import { applyDetectionRun, type DetectionRunSummary } from "@/lib/detection/persistence";
import { getEnv } from "@/lib/env";
import { CsvError, parseCsv } from "@/lib/import/csv";
import { buildCsv } from "@/lib/import/export";
import { IMPORT_FIELDS, type ColumnMapping, type ImportKind } from "@/lib/import/fields";
import { normalizeRow, type ImportRow, type LabImportRow, type LabStatus, type ReferralImportRow, type ReferralStatus } from "@/lib/import/normalize";
import { labStatusLabel, referralStatusLabel } from "@/lib/labels";
import { recordAudit } from "./audit";
import { ServiceError } from "./errors";

export const importRequestSchema = z.object({
  kind: z.enum(["lab_orders", "referrals"]),
  csv: z.string(),
  filename: z.string().trim().min(1).max(200).catch("import.csv"),
  mapping: z.record(z.string(), z.string().nullable()),
});
export type ImportRequest = z.input<typeof importRequestSchema>;

export type RowAction = "create" | "update" | "unchanged" | "error";

export interface PreviewRow {
  /** Spreadsheet line number (the header is line 1). */
  line: number;
  action: RowAction;
  patient: string | null;
  summary: string;
  messages: string[];
}

export interface ImportPreview {
  kind: ImportKind;
  filename: string;
  totalRows: number;
  counts: Record<RowAction, number>;
  rows: PreviewRow[];
}

export interface ImportResult extends ImportPreview {
  batchId: string;
  flags: Pick<DetectionRunSummary, "created" | "reopened" | "resolved">;
}

type PatientRow = { id: string; demoMrn: string; firstName: string; lastName: string };
type LabRecord = typeof labOrders.$inferSelect;
type ReferralRecord = typeof referrals.$inferSelect;

type Planned =
  | { line: number; action: "error"; patient: PatientRow | null; summary: string; messages: string[] }
  | { line: number; action: "unchanged"; patient: PatientRow; summary: string; messages: string[]; link?: { existingId: string; externalRef: string } }
  | { line: number; action: "create"; patient: PatientRow; row: ImportRow; summary: string; messages: string[] }
  | { line: number; action: "update"; patient: PatientRow; row: ImportRow; existingId: string; changes: Record<string, unknown>; summary: string; messages: string[] };

const LAB_RANK: Record<LabStatus, number> = { ordered: 0, collected: 1, resulted: 2, cancelled: 2 };
const REFERRAL_RANK: Record<ReferralStatus, number> = { sent: 0, scheduled: 1, seen: 2, records_received: 3, declined: 3, cancelled: 3 };
const LAB_TERMINAL = new Set<LabStatus>(["resulted", "cancelled"]);
const REFERRAL_TERMINAL = new Set<ReferralStatus>(["records_received", "declined", "cancelled"]);

const atDay = (date: string) => `${date}T16:00:00.000Z`;
const day = (timestamp: string | null) => (timestamp ? new Date(timestamp).toISOString().slice(0, 10) : null);
const nameTokens = (value: string) => value.toLowerCase().replace(/['’]/g, "").split(/[^a-z]+/).filter(Boolean);

function requireImport(ctx: AppContext, kind?: ImportKind): void {
  if (!can(ctx.role, "records.import")) throw new ServiceError("You don't have permission to import records. Ask a clinic admin or physician.");
  // Filing a lab result closes a lab gap, so lab imports are a clinical decision.
  if (kind === "lab_orders" && !can(ctx.role, "lab.update_status")) throw new ServiceError("Only physicians can import lab orders, because recording results closes lab gaps.");
}

function patientLabel(patient: PatientRow | null): string | null {
  return patient ? `${patient.lastName}, ${patient.firstName} · ${patient.demoMrn}` : null;
}

function naturalKey(row: ImportRow): string {
  return row.kind === "lab_orders" ? `${row.mrn}|${row.testName.toLowerCase()}|${row.orderedAt}` : `${row.mrn}|${row.specialty.toLowerCase()}|${row.referredAt}`;
}

function describe(row: ImportRow): string {
  return row.kind === "lab_orders"
    ? `${row.testName} · ordered ${row.orderedAt} · ${labStatusLabel[row.status]}`
    : `${row.specialty} referral · ${row.referredAt} · ${referralStatusLabel[row.status]}`;
}

function labChanges(existing: LabRecord, row: LabImportRow): { changes: Record<string, unknown>; messages: string[] } {
  const messages: string[] = [];
  const changes: Record<string, unknown> = {};
  if (row.status !== existing.status) {
    if (LAB_TERMINAL.has(existing.status)) messages.push(`Already ${labStatusLabel[existing.status].toLowerCase()} in SymptomWatch; kept as is.`);
    else if (LAB_RANK[row.status] < LAB_RANK[existing.status]) messages.push(`Status would move backwards (${labStatusLabel[existing.status]} → ${labStatusLabel[row.status]}); kept as is.`);
    else {
      changes.status = row.status;
      if (row.status === "resulted") changes.resultSummary = row.resultNote ?? "Result filed by import (fictional).";
      if (row.status === "cancelled") changes.statusReason = row.resultNote ?? "Cancelled per imported export.";
    }
  }
  const advancing = changes.status !== undefined || row.status === existing.status;
  if (advancing && row.collectedAt && !existing.collectedAt) changes.collectedAt = atDay(row.collectedAt);
  if (advancing && row.resultedAt && !existing.resultedAt && (changes.status ?? existing.status) === "resulted") changes.resultedAt = atDay(row.resultedAt);
  if (row.externalRef && !existing.externalRef) changes.externalRef = row.externalRef;
  return { changes, messages };
}

function referralChanges(existing: ReferralRecord, row: ReferralImportRow): { changes: Record<string, unknown>; messages: string[] } {
  const messages: string[] = [];
  const changes: Record<string, unknown> = {};
  if (row.status !== existing.status) {
    if (REFERRAL_TERMINAL.has(existing.status)) messages.push(`Already ${referralStatusLabel[existing.status].toLowerCase()} in SymptomWatch; kept as is.`);
    else if (REFERRAL_RANK[row.status] < REFERRAL_RANK[existing.status]) messages.push(`Status would move backwards (${referralStatusLabel[existing.status]} → ${referralStatusLabel[row.status]}); kept as is.`);
    else changes.status = row.status;
  }
  const advancing = changes.status !== undefined || row.status === existing.status;
  if (advancing && row.appointmentAt && day(existing.specialistAppointmentAt) !== row.appointmentAt && !existing.recordsReceivedAt) changes.specialistAppointmentAt = atDay(row.appointmentAt);
  if (advancing && row.recordsReceivedAt && !existing.recordsReceivedAt) changes.recordsReceivedAt = atDay(row.recordsReceivedAt);
  if (row.externalRef && !existing.externalRef) changes.externalRef = row.externalRef;
  return { changes, messages };
}

function changeSummary(row: ImportRow, existing: LabRecord | ReferralRecord, changes: Record<string, unknown>): string {
  const label = row.kind === "lab_orders" ? labStatusLabel : referralStatusLabel;
  const parts: string[] = [];
  if (changes.status) parts.push(`${label[existing.status as never]} → ${label[changes.status as never]}`);
  if (changes.resultedAt) parts.push(`result ${(changes.resultedAt as string).slice(0, 10)}`);
  if (changes.recordsReceivedAt) parts.push(`records ${(changes.recordsReceivedAt as string).slice(0, 10)}`);
  if (changes.specialistAppointmentAt) parts.push(`appointment ${(changes.specialistAppointmentAt as string).slice(0, 10)}`);
  if (changes.collectedAt) parts.push(`collected ${(changes.collectedAt as string).slice(0, 10)}`);
  const subject = row.kind === "lab_orders" ? row.testName : `${row.specialty} referral`;
  return `${subject}: ${parts.join(", ")}`;
}

async function plan(tx: DbTransaction, ctx: AppContext, input: z.output<typeof importRequestSchema>): Promise<Planned[]> {
  const fields = IMPORT_FIELDS[input.kind];
  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(input.csv);
  } catch (error) {
    if (error instanceof CsvError) throw new ServiceError(error.message);
    throw error;
  }
  const mapping: ColumnMapping = {};
  for (const field of fields) {
    const header = input.mapping[field.key] ?? null;
    mapping[field.key] = header && parsed.headers.includes(header) ? header : null;
  }
  const missing = fields.filter((field) => field.required && !mapping[field.key]).map((field) => field.label);
  if (missing.length) throw new ServiceError(`Choose a column for: ${missing.join(", ")}.`);

  const today = new Date().toISOString().slice(0, 10);
  const normalized = parsed.rows.map((values, index) => ({ line: index + 2, result: normalizeRow(input.kind, parsed.headers, values, mapping, today) }));
  const valid = normalized.flatMap(({ result }) => (result.ok ? [result.value] : []));

  const mrns = [...new Set(valid.map((row) => row.mrn))];
  const patientRows: PatientRow[] = mrns.length
    ? await tx.select({ id: patients.id, demoMrn: patients.demoMrn, firstName: patients.firstName, lastName: patients.lastName })
      .from(patients).where(and(eq(patients.clinicId, ctx.clinicId), inArray(patients.demoMrn, mrns)))
    : [];
  const byMrn = new Map(patientRows.map((patient) => [patient.demoMrn, patient]));
  const patientIds = patientRows.map((patient) => patient.id);
  const refs = [...new Set(valid.flatMap((row) => (row.externalRef ? [row.externalRef] : [])))];

  const table = input.kind === "lab_orders" ? labOrders : referrals;
  const scope = [eq(table.clinicId, ctx.clinicId)];
  const owners = [patientIds.length ? inArray(table.patientId, patientIds) : undefined, refs.length ? inArray(table.externalRef, refs) : undefined].filter(Boolean);
  const existing: Array<LabRecord | ReferralRecord> = owners.length
    ? await tx.select().from(table).where(and(...scope, or(...owners)))
    : [];
  const byRef = new Map(existing.flatMap((record) => (record.externalRef ? [[record.externalRef, record] as const] : [])));
  const mrnById = new Map(patientRows.map((patient) => [patient.id, patient.demoMrn]));
  const byNatural = new Map<string, LabRecord | ReferralRecord>();
  for (const record of existing) {
    const mrn = mrnById.get(record.patientId);
    if (!mrn) continue;
    const key = input.kind === "lab_orders"
      ? `${mrn}|${(record as LabRecord).testName.toLowerCase()}|${day((record as LabRecord).orderedAt)}`
      : `${mrn}|${(record as ReferralRecord).specialty.toLowerCase()}|${day((record as ReferralRecord).referredAt)}`;
    if (!byNatural.has(key)) byNatural.set(key, record);
  }

  const seenKeys = new Map<string, number>();
  const planned: Planned[] = [];
  for (const { line, result } of normalized) {
    if (!result.ok) {
      planned.push({ line, action: "error", patient: null, summary: "Not imported", messages: result.errors });
      continue;
    }
    const row = result.value;
    const summary = describe(row);
    const patient = byMrn.get(row.mrn);
    if (!patient) {
      planned.push({ line, action: "error", patient: null, summary, messages: [`No patient with ${row.mrn} in this clinic.`] });
      continue;
    }
    if (row.patientName) {
      const tokens = new Set(nameTokens(row.patientName));
      if (!nameTokens(patient.lastName).every((token) => tokens.has(token))) {
        planned.push({ line, action: "error", patient, summary, messages: [`Patient name "${row.patientName}" doesn't match ${row.mrn} (${patient.lastName}). Check for a wrong-patient row.`] });
        continue;
      }
    }
    const keys = [row.externalRef ? `ref|${row.externalRef}` : null, `nat|${naturalKey(row)}`].filter((key): key is string => key !== null);
    const duplicateOf = keys.map((key) => seenKeys.get(key)).find((value) => value !== undefined);
    if (duplicateOf !== undefined) {
      planned.push({ line, action: "error", patient, summary, messages: [`Same ${row.kind === "lab_orders" ? "order" : "referral"} as row ${duplicateOf}; only the first is imported.`] });
      continue;
    }
    for (const key of keys) seenKeys.set(key, line);

    const byReference = row.externalRef ? byRef.get(row.externalRef) : undefined;
    if (byReference && byReference.patientId !== patient.id) {
      planned.push({ line, action: "error", patient, summary, messages: [`${row.externalRef} already belongs to a different patient in SymptomWatch.`] });
      continue;
    }
    const naturalMatch = byNatural.get(naturalKey(row));
    const match = byReference ?? (naturalMatch && (!row.externalRef || !naturalMatch.externalRef || naturalMatch.externalRef === row.externalRef) ? naturalMatch : undefined);
    if (!match) {
      planned.push({ line, action: "create", patient, row, summary, messages: [] });
      continue;
    }
    const { changes, messages } = row.kind === "lab_orders" ? labChanges(match as LabRecord, row) : referralChanges(match as ReferralRecord, row);
    const { externalRef, ...substantive } = changes;
    // Recording the source system's id isn't a change the clinic needs to review, but it's saved so later imports match on it.
    const link = typeof externalRef === "string" ? { existingId: match.id, externalRef } : undefined;
    if (!Object.keys(substantive).length) planned.push({ line, action: "unchanged", patient, summary, messages: messages.length ? messages : ["Already up to date."], link });
    else planned.push({ line, action: "update", patient, row, existingId: match.id, changes, summary: changeSummary(row, match, changes), messages });
  }
  return planned;
}

function toPreview(input: z.output<typeof importRequestSchema>, planned: Planned[]): ImportPreview {
  const counts: Record<RowAction, number> = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of planned) counts[row.action] += 1;
  return {
    kind: input.kind,
    filename: input.filename,
    totalRows: planned.length,
    counts,
    rows: planned.map((row) => ({ line: row.line, action: row.action, patient: patientLabel(row.patient), summary: row.summary, messages: row.messages })),
  };
}

export async function previewImport(ctx: AppContext, raw: ImportRequest, database?: DatabaseHandle): Promise<ImportPreview> {
  const input = importRequestSchema.parse(raw);
  requireImport(ctx, input.kind);
  return withTenant(ctx, async (tx) => toPreview(input, await plan(tx, ctx, input)), database);
}

export async function commitImport(ctx: AppContext, raw: ImportRequest, database?: DatabaseHandle): Promise<ImportResult> {
  const input = importRequestSchema.parse(raw);
  requireImport(ctx, input.kind);
  return withTenant(ctx, async (tx) => {
    const planned = await plan(tx, ctx, input);
    const preview = toPreview(input, planned);
    if (preview.counts.create + preview.counts.update === 0 && preview.counts.unchanged === 0) {
      throw new ServiceError("No rows can be imported. Fix the errors in the preview and try again.");
    }
    const [batch] = await tx.insert(importBatches).values({
      clinicId: ctx.clinicId,
      kind: input.kind,
      filename: input.filename,
      rowCount: preview.totalRows,
      createdCount: preview.counts.create,
      updatedCount: preview.counts.update,
      unchangedCount: preview.counts.unchanged,
      errorCount: preview.counts.error,
      createdBy: ctx.userId,
    }).returning({ id: importBatches.id });

    const affected = new Set<string>();
    for (const item of planned) {
      if (item.action === "create") {
        affected.add(item.patient.id);
        const row = item.row;
        if (row.kind === "lab_orders") {
          await tx.insert(labOrders).values({
            clinicId: ctx.clinicId,
            patientId: item.patient.id,
            testName: row.testName,
            orderedAt: atDay(row.orderedAt),
            expectedWithinDays: row.expectedWithinDays,
            status: row.status,
            collectedAt: row.collectedAt ? atDay(row.collectedAt) : null,
            resultedAt: row.status === "resulted" && row.resultedAt ? atDay(row.resultedAt) : null,
            resultSummary: row.status === "resulted" ? row.resultNote ?? "Result filed by import (fictional)." : null,
            statusReason: row.status === "cancelled" ? row.resultNote ?? "Cancelled per imported export." : null,
            externalRef: row.externalRef,
            importBatchId: batch.id,
          });
        } else {
          await tx.insert(referrals).values({
            clinicId: ctx.clinicId,
            patientId: item.patient.id,
            specialty: row.specialty,
            reason: row.reason,
            referredAt: atDay(row.referredAt),
            expectedWithinDays: row.expectedWithinDays,
            status: row.status,
            specialistAppointmentAt: row.appointmentAt ? atDay(row.appointmentAt) : null,
            recordsReceivedAt: row.recordsReceivedAt ? atDay(row.recordsReceivedAt) : null,
            externalRef: row.externalRef,
            importBatchId: batch.id,
          });
        }
      } else if (item.action === "update") {
        affected.add(item.patient.id);
        const table = input.kind === "lab_orders" ? labOrders : referrals;
        await tx.update(table).set(item.changes).where(and(eq(table.clinicId, ctx.clinicId), eq(table.id, item.existingId)));
      } else if (item.action === "unchanged" && item.link) {
        const table = input.kind === "lab_orders" ? labOrders : referrals;
        await tx.update(table).set({ externalRef: item.link.externalRef }).where(and(eq(table.clinicId, ctx.clinicId), eq(table.id, item.link.existingId)));
      }
    }

    const summary = affected.size
      ? await applyDetectionRun(tx, {
        clinicId: ctx.clinicId,
        actorUserId: ctx.userId,
        asOf: new Date(),
        patientIds: [...affected],
        externalAiEnabled: getEnv().EXTERNAL_AI_ENABLED,
      })
      : { created: 0, reopened: 0, resolved: 0 };
    const flags = { created: summary.created, reopened: summary.reopened, resolved: summary.resolved };
    await recordAudit(tx, ctx, "records.imported", { type: "import_batch", id: batch.id }, { kind: input.kind, ...preview.counts, flags });
    return { ...preview, batchId: batch.id, flags };
  }, database);
}

export interface ImportBatchView {
  id: string;
  kind: ImportKind;
  filename: string;
  rowCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  createdAt: string;
  createdByName: string | null;
}

const batchFields = {
  id: importBatches.id,
  kind: importBatches.kind,
  filename: importBatches.filename,
  rowCount: importBatches.rowCount,
  createdCount: importBatches.createdCount,
  updatedCount: importBatches.updatedCount,
  unchangedCount: importBatches.unchangedCount,
  errorCount: importBatches.errorCount,
  createdAt: importBatches.createdAt,
  createdByName: sql<string | null>`(select display_name from ${users} where ${users.id} = ${importBatches.createdBy})`,
};

export async function listImportBatches(ctx: AppContext, database?: DatabaseHandle): Promise<ImportBatchView[]> {
  requireImport(ctx);
  return withTenant(ctx, (tx) => tx
    .select(batchFields)
    .from(importBatches)
    .where(eq(importBatches.clinicId, ctx.clinicId))
    .orderBy(desc(importBatches.createdAt))
    .limit(10), database);
}

/** Batches are committed atomically with their records; failed imports leave no batch. */
export async function getLastSuccessfulImport(ctx: AppContext, database?: DatabaseHandle): Promise<ImportBatchView | null> {
  requireImport(ctx);
  return withTenant(ctx, async (tx) => {
    const [batch] = await tx.select(batchFields).from(importBatches)
      .where(eq(importBatches.clinicId, ctx.clinicId))
      .orderBy(desc(importBatches.createdAt), desc(importBatches.id)).limit(1);
    return batch ?? null;
  }, database);
}

// ---------------------------------------------------------------- sample export

const usDate = (iso: string | null) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");
const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const refFor = (prefix: string, id: string) => `${prefix}-${id.slice(0, 8).toUpperCase()}`;

const LAB_EXPORT_STATUS: Record<LabStatus, string> = { ordered: "Pending", collected: "Collected", resulted: "Final", cancelled: "Cancelled" };
const REFERRAL_EXPORT_STATUS: Record<ReferralStatus, string> = {
  sent: "Referred", scheduled: "Scheduled", seen: "Seen", records_received: "Consult Note Received", declined: "Declined", cancelled: "Cancelled",
};

/**
 * A realistic EHR-style export built from this clinic's current fictional
 * records: some open orders now have results, some are unchanged, two are new,
 * and three rows contain the kinds of mistakes the preview should catch.
 */
export async function buildSampleExport(ctx: AppContext, kind: ImportKind, database?: DatabaseHandle): Promise<{ filename: string; csv: string }> {
  requireImport(ctx, kind);
  return withTenant(ctx, async (tx) => {
    const clinicPatients = await tx.select({ id: patients.id, demoMrn: patients.demoMrn, firstName: patients.firstName, lastName: patients.lastName })
      .from(patients).where(and(eq(patients.clinicId, ctx.clinicId), eq(patients.careStatus, "active"), eq(patients.isSynthetic, true), sql`${patients.demoMrn} ~ '^DEMO-[0-9]{5}$'`)).orderBy(patients.demoMrn);
    if (clinicPatients.length < 2) throw new ServiceError("This clinic needs at least two patients to build a sample export.");
    const byId = new Map(clinicPatients.map((patient) => [patient.id, patient]));
    const name = (patient: PatientRow) => `${patient.lastName}, ${patient.firstName}`;
    const [first, second] = clinicPatients;
    const yesterday = isoDaysAgo(1);
    const lines: string[][] = [];

    if (kind === "lab_orders") {
      lines.push(["Order #", "MRN", "Patient", "Test Description", "Order Date", "Order Status", "Collection Date", "Result Date", "Result Comment"]);
      const open = (await tx.select().from(labOrders)
        .where(and(eq(labOrders.clinicId, ctx.clinicId), inArray(labOrders.status, ["ordered", "collected"]))).orderBy(labOrders.orderedAt))
        .filter((lab) => byId.has(lab.patientId));
      open.forEach((lab, index) => {
        const patient = byId.get(lab.patientId)!;
        const ordered = day(lab.orderedAt)!;
        if (index % 2 === 0) {
          const collected = day(lab.collectedAt) ?? (ordered < yesterday ? ordered : yesterday);
          lines.push([lab.externalRef ?? refFor("LAB", lab.id), patient.demoMrn, name(patient), lab.testName, usDate(ordered), "Final", usDate(collected), usDate(yesterday), "Within reference range (fictional)"]);
        } else {
          lines.push([lab.externalRef ?? refFor("LAB", lab.id), patient.demoMrn, name(patient), lab.testName, usDate(ordered), LAB_EXPORT_STATUS[lab.status], usDate(day(lab.collectedAt)), "", ""]);
        }
      });
      lines.push(["LAB-90001", first.demoMrn, name(first), "Lipid panel", usDate(isoDaysAgo(3)), "Pending", "", "", ""]);
      lines.push(["LAB-90002", second.demoMrn, name(second), "TSH", usDate(isoDaysAgo(40)), "Pending", "", "", ""]);
      lines.push(["LAB-90001", first.demoMrn, name(first), "Lipid panel", usDate(isoDaysAgo(3)), "Pending", "", "", ""]);
      lines.push(["LAB-90004", first.demoMrn, name(first), "Vitamin B12", "13/45/2026", "Pending", "", "", ""]);
      lines.push(["LAB-90005", second.demoMrn, "Nobody, Wrong", "Ferritin", usDate(isoDaysAgo(6)), "Pending", "", "", ""]);
    } else {
      lines.push(["Referral ID", "MRN", "Patient", "Specialty", "Reason", "Referral Date", "Referral Status", "Appointment Date", "Records Received"]);
      const open = (await tx.select().from(referrals)
        .where(and(eq(referrals.clinicId, ctx.clinicId), inArray(referrals.status, ["sent", "scheduled", "seen"]))).orderBy(referrals.referredAt))
        .filter((referral) => byId.has(referral.patientId) && !referral.recordsReceivedAt);
      open.forEach((referral, index) => {
        const patient = byId.get(referral.patientId)!;
        const referred = day(referral.referredAt)!;
        const appointment = day(referral.specialistAppointmentAt);
        if (index % 2 === 0) {
          const seenOn = appointment && appointment <= yesterday ? appointment : yesterday;
          lines.push([referral.externalRef ?? refFor("REF", referral.id), patient.demoMrn, name(patient), referral.specialty, referral.reason, usDate(referred), "Consult Note Received", usDate(seenOn), usDate(yesterday)]);
        } else {
          lines.push([referral.externalRef ?? refFor("REF", referral.id), patient.demoMrn, name(patient), referral.specialty, referral.reason, usDate(referred), REFERRAL_EXPORT_STATUS[referral.status], usDate(appointment), ""]);
        }
      });
      lines.push(["REF-90001", first.demoMrn, name(first), "Dermatology", "Changing mole (fictional)", usDate(isoDaysAgo(5)), "Referred", "", ""]);
      lines.push(["REF-90002", second.demoMrn, name(second), "Cardiology", "Exertional chest discomfort (fictional)", usDate(isoDaysAgo(60)), "Referred", "", ""]);
      lines.push(["REF-90001", first.demoMrn, name(first), "Dermatology", "Changing mole (fictional)", usDate(isoDaysAgo(5)), "Referred", "", ""]);
      lines.push(["REF-90004", first.demoMrn, name(first), "Neurology", "Headaches (fictional)", usDate(isoDaysAgo(20)), "Lost in transit", "", ""]);
      lines.push(["REF-90005", second.demoMrn, "Nobody, Wrong", "Gastroenterology", "Reflux (fictional)", usDate(isoDaysAgo(15)), "Referred", "", ""]);
    }
    const csv = buildCsv(lines);
    return { filename: `fictional-${kind === "lab_orders" ? "lab-orders" : "referrals"}-sample-${new Date().toISOString().slice(0, 10)}.csv`, csv };
  }, database);
}
