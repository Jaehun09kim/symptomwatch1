/**
 * Role → permission matrix (ARCHITECTURE §6.3). UI uses it to hide controls;
 * Server Actions and services use it to authorize; Postgres RLS enforces the
 * same boundaries again underneath.
 */
import type { MemberRole } from "@/lib/labels";

export const PERMISSIONS = [
  "patient.read_demographics",
  "patient.read_clinical",
  "appointment.manage",
  "referral.update_admin_status",
  "lab.update_status",
  "records.import",
  "task.read",
  "task.manage",
  "task.manage_clinical",
  "flag.read",
  "flag.review",
  "detection.run",
  "detection.configure",
  "staff.manage",
  "audit.read",
  "demo.reset",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const matrix: Record<MemberRole, ReadonlySet<Permission>> = {
  clinic_admin: new Set<Permission>([
    "patient.read_demographics",
    "patient.read_clinical",
    "appointment.manage",
    "referral.update_admin_status",
    "records.import",
    "task.read",
    "task.manage",
    "flag.read",
    "detection.run",
  ]),
  physician: new Set<Permission>([
    "patient.read_demographics",
    "patient.read_clinical",
    "appointment.manage",
    "referral.update_admin_status",
    "lab.update_status",
    "records.import",
    "task.read",
    "task.manage",
    "task.manage_clinical",
    "flag.read",
    "flag.review",
    "detection.run",
    "detection.configure",
  ]),
  staff: new Set<Permission>([
    "patient.read_demographics",
    "appointment.manage",
    "referral.update_admin_status",
    "task.read",
    "task.manage",
  ]),
};

/** Granted only by "manages the clinic", never by a job role (onboarding M1). */
export const MANAGE_PERMISSIONS = ["staff.manage", "audit.read", "demo.reset"] as const satisfies readonly Permission[];

/** A member's access: job role plus the server-side manager flag. */
export interface Access {
  role: MemberRole;
  canManage: boolean;
}

const isManagePermission = (permission: Permission): boolean => (MANAGE_PERMISSIONS as readonly Permission[]).includes(permission);

/** A bare role answers role permissions only; management needs `{ role, canManage }`. */
export function can(subject: MemberRole | Access, permission: Permission): boolean {
  if (isManagePermission(permission)) return typeof subject !== "string" && subject.canManage;
  return matrix[typeof subject === "string" ? subject : subject.role].has(permission);
}

export function permissionsFor(subject: MemberRole | Access): Permission[] {
  return PERMISSIONS.filter((permission) => can(subject, permission));
}
