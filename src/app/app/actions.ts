"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { issueResetLinkForMember } from "@/lib/auth/accounts";
import { authorizeAction, AuthorizationError } from "@/lib/auth/current";
import type { AppContext } from "@/lib/authz/context";
import type { Permission } from "@/lib/authz/permissions";
import type { MemberRole } from "@/lib/labels";
import { resetDemoClinic } from "@/lib/services/demo-sandbox";
import { addFlagFeedback, confirmFlag, dismissFlag, runDetectionForClinic, snoozeFlag, unsnoozeFlag } from "@/lib/services/detection";
import { RULE_IDS, updateRuleSettings } from "@/lib/services/rule-settings";
import { ServiceError } from "@/lib/services/errors";
import { scheduleAppointment, updateAppointment, updateLab, updateReferral } from "@/lib/services/records";
import { cancelJoinCode, createJoinCode, decideJoinRequest } from "@/lib/services/join-codes";
import { changeMemberRole, inviteStaff, revokeInvitation, setMemberCanManage, setMemberStatus } from "@/lib/services/staff";
import { createTask, updateTask } from "@/lib/services/tasks";
import { fieldErrorsFrom, inviteSchema, type FieldErrors } from "@/lib/validation/auth";

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  /** Extra payload, e.g. an invitation link to copy. */
  link?: string;
  /** A freshly generated join code (shown once; only its hash is stored). */
  joinCode?: { id: string; display: string; expiresAt: string };
  /** Which code a successful cancellation applied to. */
  cancelledCodeId?: string;
}

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
};

/** Authorize → run → refresh; only user-safe messages leave the server. */
async function run(
  permission: Permission,
  fn: (ctx: AppContext, actorUserId: string) => Promise<ActionResult | void>,
  success: string,
): Promise<ActionResult> {
  try {
    const { ctx, session } = await authorizeAction(permission);
    const result = await fn(ctx, session.originalUserId ?? session.userId);
    refresh();
    return result ?? { ok: true, message: success };
  } catch (error) {
    if (error instanceof ServiceError || error instanceof AuthorizationError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) };
    console.error("action failed", error);
    return { ok: false, message: "Something went wrong. Nothing was saved — please try again." };
  }
}

export async function createTaskAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("task.manage", (ctx) => createTask(ctx, {
    title: str(form, "title") ?? "",
    description: str(form, "description") ?? "",
    category: str(form, "category") as never,
    patientId: str(form, "patientId") ?? "",
    assigneeId: str(form, "assigneeId") ?? "",
    dueDate: str(form, "dueDate") ?? "",
  }).then(() => undefined), "Task created.");
}

export async function updateTaskAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("task.manage", (ctx) => updateTask(ctx, {
    taskId: str(form, "taskId") ?? "",
    status: (str(form, "status") || undefined) as never,
    assigneeId: str(form, "assigneeId"),
    outcome: str(form, "outcome"),
    dueDate: str(form, "dueDate") || undefined,
  }), "Task updated.");
}

export async function recordTaskOutcomeAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("task.manage", (ctx) => updateTask(ctx, {
    taskId: str(form, "taskId") ?? "",
    outcomeChoice: str(form, "outcomeChoice") ?? "",
    outcomeNote: str(form, "outcomeNote") ?? "",
  }), "Outcome recorded.");
}

export async function updateAppointmentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("appointment.manage", (ctx) => updateAppointment(ctx, {
    appointmentId: str(form, "appointmentId") ?? "",
    status: str(form, "status") as never,
    reason: str(form, "reason") ?? "",
  }), "Appointment updated.");
}

export async function scheduleAppointmentAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("appointment.manage", (ctx) => scheduleAppointment(ctx, {
    patientId: str(form, "patientId") ?? "",
    purpose: str(form, "purpose") as never,
    date: str(form, "date") ?? "",
    status: (str(form, "status") ?? "scheduled") as never,
    reason: str(form, "reason") ?? "",
  }), "Appointment added.");
}

export async function updateReferralAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("referral.update_admin_status", (ctx) => updateReferral(ctx, {
    referralId: str(form, "referralId") ?? "",
    status: str(form, "status") as never,
    date: str(form, "date") ?? "",
    reason: str(form, "reason") ?? "",
  }), "Referral updated.");
}

export async function updateLabAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("lab.update_status", (ctx) => updateLab(ctx, {
    labId: str(form, "labId") ?? "",
    status: str(form, "status") as never,
    date: str(form, "date") ?? "",
    summary: str(form, "summary") ?? "",
  }), "Lab order updated.");
}

export async function inviteStaffAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse({ email: str(form, "email"), role: str(form, "role") });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  return run("staff.manage", async (ctx) => {
    const { link } = await inviteStaff(ctx, parsed.data);
    return { ok: true, message: `Invitation created for ${parsed.data.email}. No email was sent — share this link:`, link };
  }, "Invitation created.");
}

export async function revokeInvitationAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("staff.manage", (ctx) => revokeInvitation(ctx, str(form, "invitationId") ?? ""), "Invitation revoked.");
}

export async function setMemberCanManageAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("staff.manage", (ctx) => setMemberCanManage(ctx, {
    userId: str(form, "userId") ?? "",
    canManage: str(form, "canManage") === "true",
  }), "Manager access updated.");
}

export async function changeRoleAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("staff.manage", (ctx) => changeMemberRole(ctx, {
    userId: str(form, "userId") ?? "",
    role: str(form, "role") as MemberRole,
  }), "Role updated.");
}

export async function setMemberStatusAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("staff.manage", (ctx) => setMemberStatus(ctx, {
    userId: str(form, "userId") ?? "",
    status: str(form, "status") === "disabled" ? "disabled" : "active",
  }), "Access updated.");
}

export async function issueResetLinkAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("staff.manage", async (ctx, actorUserId) => {
    const result = await issueResetLinkForMember({ adminUserId: actorUserId, clinicId: ctx.clinicId, memberUserId: str(form, "userId") ?? "" });
    if (!result.ok) return { ok: false, message: result.error };
    return { ok: true, message: "One-time reset link (expires in 30 minutes). Share it with the staff member directly:", link: result.link };
  }, "Reset link created.");
}

export async function resetDemoAction(): Promise<void> {
  const { ctx } = await authorizeAction("demo.reset");
  await resetDemoClinic({ clinicId: ctx.clinicId, actorUserId: ctx.actorUserId, effectiveUserId: ctx.userId });
  redirect("/app?reset=1");
}

export async function runDetectionAction(): Promise<ActionResult> {
  return run("detection.run", async (ctx) => {
    const summary = await runDetectionForClinic(ctx);
    return {
      ok: true,
      message: `Detection complete: ${summary.patientsEvaluated} patients checked, ${summary.created} new, ${summary.reopened} reopened, ${summary.resolved} resolved by new documentation.`,
    };
  }, "Detection complete.");
}

export async function confirmFlagAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("flag.review", (ctx) => confirmFlag(ctx, {
    flagId: str(form, "flagId") ?? "",
    note: str(form, "note") ?? "",
    createTask: form.get("createTask") === "on",
    taskTitle: str(form, "taskTitle") ?? "",
    taskCategory: str(form, "taskCategory") as never,
    assigneeId: str(form, "assigneeId"),
    dueDate: str(form, "dueDate") ?? "",
  }), "Gap confirmed.");
}

export async function dismissFlagAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("flag.review", (ctx) => dismissFlag(ctx, {
    flagId: str(form, "flagId") ?? "",
    reasonCode: (str(form, "reasonCode") || "other") as never,
    reason: str(form, "reason") ?? "",
  }), "Flag dismissed.");
}

export async function snoozeFlagAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("flag.review", (ctx) => snoozeFlag(ctx, {
    flagId: str(form, "flagId") ?? "",
    until: str(form, "until") ?? "",
    note: str(form, "note") ?? "",
  }), "Flag snoozed. It will return to the queue on that date, or sooner if the record changes.");
}

export async function unsnoozeFlagAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("flag.review", (ctx) => unsnoozeFlag(ctx, { flagId: str(form, "flagId") ?? "" }), "Flag is back in the review queue.");
}

export async function updateRuleSettingsAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("detection.configure", async (ctx) => {
    const summary = await updateRuleSettings(ctx, {
      overdueGraceDays: str(form, "overdueGraceDays") as never,
      labGraceDays: str(form, "labGraceDays") as never,
      referralSentGraceDays: str(form, "referralSentGraceDays") as never,
      referralRecordsDays: str(form, "referralRecordsDays") as never,
      symptomMinEncounters: str(form, "symptomMinEncounters") as never,
      symptomMinSpanDays: str(form, "symptomMinSpanDays") as never,
      disabledRules: RULE_IDS.filter((rule) => form.get(`enabled:${rule}`) !== "on"),
    });
    const parts = [
      summary.created && `${summary.created} new`,
      summary.reopened && `${summary.reopened} reopened`,
      summary.resolved && `${summary.resolved} closed (no longer meet the settings)`,
      summary.suppressed && `${summary.suppressed} parked (rule turned off)`,
    ].filter(Boolean);
    return { ok: true, message: `Settings saved and detection re-run${parts.length ? `: ${parts.join(", ")}` : " — no flags changed"}.` };
  }, "Settings saved.");
}

export async function flagFeedbackAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run("flag.review", (ctx) => addFlagFeedback(ctx, {
    flagId: str(form, "flagId") ?? "",
    verdict: str(form, "verdict") as never,
    comment: str(form, "comment") ?? "",
  }), "Feedback recorded — thank you.");
}

const ROLES: readonly MemberRole[] = ["physician", "staff", "clinic_admin"];
const asRole = (value: string | undefined): MemberRole | undefined => ROLES.find((role) => role === value);

export async function createJoinCodeAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const role = asRole(str(form, "role"));
  if (!role) return { ok: false, message: "Choose a role for this code." };
  const approvalMode = str(form, "approvalMode") === "instant" ? "instant" : "approve";
  return run("staff.manage", async (ctx) => {
    const joinCode = await createJoinCode(ctx, { role, approvalMode });
    return { ok: true, message: "Code ready. It expires in 90 seconds.", joinCode };
  }, "Code ready.");
}

export async function cancelJoinCodeAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const codeId = str(form, "codeId") ?? "";
  return run("staff.manage", async (ctx) => {
    await cancelJoinCode(ctx, codeId);
    return { ok: true, message: "Code cancelled.", cancelledCodeId: codeId };
  }, "Code cancelled.");
}

export async function decideJoinRequestAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const decision = str(form, "decision") === "approve" ? "approve" : "decline";
  return run("staff.manage", (ctx) => decideJoinRequest(ctx, {
    requestId: str(form, "requestId") ?? "",
    decision,
    role: asRole(str(form, "role")),
  }), decision === "approve" ? "Approved — they can enter the clinic now." : "Request declined.");
}
