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
    "staff.manage",
    "audit.read",
    "demo.reset",
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

export function can(role: MemberRole, permission: Permission): boolean {
  return matrix[role].has(permission);
}

export function permissionsFor(role: MemberRole): Permission[] {
  return PERMISSIONS.filter((permission) => matrix[role].has(permission));
}
