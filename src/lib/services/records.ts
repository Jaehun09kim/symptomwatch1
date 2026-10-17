/**
 * Administrative updates to appointments, referrals, and labs — the actions
 * that actually close follow-up loops. Each change is audited, then the
 * patient's flags are refreshed by the system detection job after commit.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AppContext } from "@/lib/authz/context";
import { can, type Permission } from "@/lib/authz/permissions";
import { appointments, labOrders, patients, referrals } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import type { DatabaseHandle } from "@/lib/db/types";
import { checkFreeText, describePhiFailure } from "@/lib/validation/phi-guard";
import { recordAudit } from "./audit";
import { refreshPatientFlags } from "./detection-system";
import { ServiceError } from "./errors";

async function refreshFlags(ctx: AppContext, patientId: string, database?: DatabaseHandle): Promise<void> {
  await refreshPatientFlags({ clinicId: ctx.clinicId, patientId, actorUserId: ctx.userId }, database);
}

function requirePermission(ctx: AppContext, permission: Permission): void {
  if (!can(ctx.role, permission)) throw new ServiceError("You don't have permission to update this record.");
}

function assertNoPhi(label: string, value: string | undefined): void {
  if (!value) return;
  const check = checkFreeText(value);
  if (!check.ok) throw new ServiceError(describePhiFailure(label, check));
}

const atDay = (date: string) => `${date}T16:00:00.000Z`;
const note = z.string().trim().max(300).optional().default("");

export const appointmentUpdateSchema = z.object({
  appointmentId: z.uuid(),
  status: z.enum(["scheduled", "confirmed", "completed", "no_show", "cancelled_by_patient", "cancelled_by_clinic", "rescheduled"]),
  reason: note,
});

export async function updateAppointment(ctx: AppContext, raw: z.input<typeof appointmentUpdateSchema>, database?: DatabaseHandle): Promise<void> {
  requirePermission(ctx, "appointment.manage");
  const input = appointmentUpdateSchema.parse(raw);
  assertNoPhi("Reason", input.reason);
  const patientId = await withTenant(ctx, async (tx) => {
    const [row] = await tx.update(appointments)
      .set({ status: input.status, statusReason: input.reason || null })
      .where(and(eq(appointments.clinicId, ctx.clinicId), eq(appointments.id, input.appointmentId)))
      .returning({ patientId: appointments.patientId });
    if (!row) throw new ServiceError("Appointment not found.");
    await recordAudit(tx, ctx, "appointment.updated", { type: "appointment", id: input.appointmentId }, { status: input.status });
    return row.patientId;
  }, database);
  await refreshFlags(ctx, patientId, database);
}

export const appointmentCreateSchema = z.object({
  patientId: z.uuid(),
  purpose: z.enum(["follow_up", "lab_draw", "annual", "new_concern", "specialist"]),
  date: z.iso.date("Choose a date"),
  status: z.enum(["scheduled", "confirmed"]).default("scheduled"),
  reason: note,
});

export async function scheduleAppointment(ctx: AppContext, raw: z.input<typeof appointmentCreateSchema>, database?: DatabaseHandle): Promise<void> {
  requirePermission(ctx, "appointment.manage");
  const input = appointmentCreateSchema.parse(raw);
  assertNoPhi("Note", input.reason);
  const patientId = await withTenant(ctx, async (tx) => {
    const [patient] = await tx.select({ id: patients.id }).from(patients)
      .where(and(eq(patients.clinicId, ctx.clinicId), eq(patients.id, input.patientId)));
    if (!patient) throw new ServiceError("Patient not found.");
    const [row] = await tx.insert(appointments).values({
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      scheduledFor: atDay(input.date),
      purpose: input.purpose,
      status: input.status,
      statusReason: input.reason || null,
    }).returning({ id: appointments.id });
    await recordAudit(tx, ctx, "appointment.created", { type: "appointment", id: row.id }, { purpose: input.purpose });
    return input.patientId;
  }, database);
  await refreshFlags(ctx, patientId, database);
}

export const referralUpdateSchema = z.object({
  referralId: z.uuid(),
  status: z.enum(["scheduled", "seen", "records_received", "declined", "cancelled"]),
  date: z.iso.date().optional().or(z.literal("")).transform((value) => value || undefined),
  reason: note,
});

export async function updateReferral(ctx: AppContext, raw: z.input<typeof referralUpdateSchema>, database?: DatabaseHandle): Promise<void> {
  requirePermission(ctx, "referral.update_admin_status");
  const input = referralUpdateSchema.parse(raw);
  assertNoPhi("Note", input.reason);
  if ((input.status === "scheduled" || input.status === "records_received") && !input.date) {
    throw new ServiceError(input.status === "scheduled" ? "Enter the specialist appointment date." : "Enter the date records were received.");
  }
  const patientId = await withTenant(ctx, async (tx) => {
    const changes: Partial<typeof referrals.$inferInsert> = { status: input.status, statusReason: input.reason || null };
    if (input.status === "scheduled" && input.date) changes.specialistAppointmentAt = atDay(input.date);
    if (input.status === "records_received" && input.date) changes.recordsReceivedAt = atDay(input.date);
    const [row] = await tx.update(referrals).set(changes)
      .where(and(eq(referrals.clinicId, ctx.clinicId), eq(referrals.id, input.referralId)))
      .returning({ patientId: referrals.patientId });
    if (!row) throw new ServiceError("Referral not found.");
    await recordAudit(tx, ctx, "referral.updated", { type: "referral", id: input.referralId }, { status: input.status });
    return row.patientId;
  }, database);
  await refreshFlags(ctx, patientId, database);
}

export const labUpdateSchema = z.object({
  labId: z.uuid(),
  status: z.enum(["collected", "resulted", "cancelled"]),
  date: z.iso.date().optional().or(z.literal("")).transform((value) => value || undefined),
  summary: z.string().trim().max(300).optional().default(""),
});

export async function updateLab(ctx: AppContext, raw: z.input<typeof labUpdateSchema>, database?: DatabaseHandle): Promise<void> {
  requirePermission(ctx, "lab.update_status");
  const input = labUpdateSchema.parse(raw);
  assertNoPhi("Summary", input.summary);
  if (input.status === "cancelled" && !input.summary) throw new ServiceError("Give a reason for cancelling the order.");
  if (input.status === "resulted" && !input.summary) throw new ServiceError("Add a short result note (fictional).");
  const date = atDay(input.date ?? new Date().toISOString().slice(0, 10));
  const patientId = await withTenant(ctx, async (tx) => {
    const changes: Partial<typeof labOrders.$inferInsert> = { status: input.status };
    if (input.status === "collected") changes.collectedAt = date;
    if (input.status === "resulted") Object.assign(changes, { resultedAt: date, resultSummary: input.summary });
    if (input.status === "cancelled") changes.statusReason = input.summary;
    const [row] = await tx.update(labOrders).set(changes)
      .where(and(eq(labOrders.clinicId, ctx.clinicId), eq(labOrders.id, input.labId)))
      .returning({ patientId: labOrders.patientId });
    if (!row) throw new ServiceError("Lab order not found.");
    await recordAudit(tx, ctx, "lab.updated", { type: "lab_order", id: input.labId }, { status: input.status });
    return row.patientId;
  }, database);
  await refreshFlags(ctx, patientId, database);
}
