import { describe, expect, it } from "vitest";
import { can, MANAGE_PERMISSIONS } from "@/lib/authz/permissions";
import type { MemberRole } from "@/lib/labels";

const ROLES: MemberRole[] = ["clinic_admin", "physician", "staff"];

describe("permissions: job role vs. manager flag", () => {
  it("never grants management from a bare job role", () => {
    expect(can("clinic_admin", "staff.manage")).toBe(false);
    for (const role of ROLES) for (const permission of MANAGE_PERMISSIONS) expect(can(role, permission)).toBe(false);
  });

  it("grants management only through the manager flag", () => {
    expect(can({ role: "staff", canManage: true }, "staff.manage")).toBe(true);
    expect(can({ role: "staff", canManage: true }, "audit.read")).toBe(true);
    expect(can({ role: "staff", canManage: true }, "demo.reset")).toBe(true);
    expect(can({ role: "clinic_admin", canManage: false }, "staff.manage")).toBe(false);
  });

  it("keeps clinical access tied to the job role", () => {
    expect(can({ role: "staff", canManage: true }, "patient.read_clinical")).toBe(false);
    expect(can({ role: "physician", canManage: false }, "flag.review")).toBe(true);
  });
});
