# Onboarding M1 — Role Split ("manages the clinic") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate a member's job role (physician / front desk / practice admin) from a new "manages the clinic" flag that alone grants staff management, audit-log access and demo reset — enforced in services, sessions and Postgres RLS.

**Architecture:** A `memberships.can_manage` column (migration `0009`) read server-side through a `SECURITY DEFINER` function, mirroring `app.current_role()`. `can()` accepts either a bare role (role permissions only) or `{ role, canManage }`; the three management permissions come only from the flag. Membership-management mutations lock the clinic's membership rows, re-check the actor after locking, forbid self-changes, and keep at least one active human manager.

**Tech Stack:** Next.js 16, TypeScript, Drizzle, PGlite/Postgres RLS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-clinic-onboarding-design.md` (milestone 1, plus security findings 1, 2, 3, 7).

## Global Constraints

- Applied migrations are never edited; the change is a new file `db/migrations/0009_manager_flag.sql`; run `npm run db:bundle` so `src/lib/db/migrations.generated.ts` includes it.
- Tenant queries go through `withTenant`; do not add files to the `withSystem` allowlist (`tests/unit/system-boundary.test.ts`).
- The manager flag is read from the membership row server-side; never from the client, a GUC, or the session cookie.
- Management permissions are exactly `staff.manage`, `audit.read`, `demo.reset`.
- Admin-issued password reset links work only in sandbox clinics (`clinics.is_sandbox = true`).
- No self role change and no self manager-flag change (service error text: "You can't change your own access. Ask another manager.").
- A clinic always keeps at least one active manager whose user is not a placeholder (error text: "A clinic needs at least one active manager.").
- Light app tokens only; e2e selectors in `tests/e2e/*.spec.ts` keep working or are updated deliberately.
- Definition of done per task: `npm run check` green; Task 4 also `npm run test:e2e` green.

## Review Focus

1. Sessions that already exist when a manager's flag changes — expect the new access on the next request, no re-login (Task 2 test `session reflects can_manage changes immediately`).
2. A "view as" session in a sandbox whose human actor loses the manager flag — expect the session to end (Task 2 test `view-as ends when the actor stops managing`).
3. A manager bypassing the service with a direct tenant-path SQL update of their own row — expect Postgres to refuse (Task 1 test `trigger blocks self role and can_manage changes`).
4. The last human manager disabling or un-flagging themselves, or two managers removing each other concurrently — expect a refusal and at least one manager left (Task 3 tests `keeps a human manager` and `concurrent removals keep one manager`).
5. Invitations created before or after the migration for role `clinic_admin` — expect the joiner to get the job role but `can_manage = false` (Task 3 test `invited practice admin is not a manager`).

---

### Task 1: Migration 0009 — manager flag, RLS replacement, self-change trigger

**Files:**
- Create: `db/migrations/0009_manager_flag.sql`
- Modify: `src/lib/db/schema.ts` (memberships: add `canManage: boolean("can_manage").notNull().default(false)`)
- Regenerate: `src/lib/db/migrations.generated.ts` (`npm run db:bundle`)
- Test: `tests/integration/manager-flag-rls.test.ts`

**Interfaces:**
- Produces: column `memberships.can_manage`; SQL function `app.current_can_manage() RETURNS boolean`; policies `clinics_update`, `memberships_insert/update/delete`, `invitations_insert/update/delete`, `audit_logs_select` now gated by `app.current_can_manage()`; trigger `memberships_protect_self` on `memberships`.

- [ ] **Step 1: Write the failing tests** in `tests/integration/manager-flag-rls.test.ts`:
  - `backfills managers from clinic_admin on a populated database`: create a PGlite DB, `migrate(db, bundledMigrations.filter((m) => m.name < "0009"))`, insert via raw SQL one clinic, three users and memberships with roles `clinic_admin`, `physician`, `staff`; then `migrate(db)`; assert `can_manage` is `true` only for the `clinic_admin` row.
  - `only managers can write memberships and read the audit log`: on a seeded clinic, a physician without the flag gets 0 rows from `withTenant(... select audit_logs)` and an update of another membership affects 0 rows / throws; a staff member with `can_manage = true` (set via `withSystem` in the test) reads audit rows and can update another member's role.
  - `manager flag never grants clinical reads`: a staff member with `can_manage = true` reads 0 rows from `encounters` and `lab_orders`.
  - `trigger blocks self role and can_manage changes`: as a manager via `withTenant`, updating their own membership's `role` or `can_manage` throws.
- [ ] **Step 2: Run** `npx vitest run tests/integration/manager-flag-rls.test.ts` — Expected: FAIL (column/function missing).
- [ ] **Step 3: Write `0009_manager_flag.sql`:** `ALTER TABLE memberships ADD COLUMN can_manage boolean NOT NULL DEFAULT false;` backfill `UPDATE memberships SET can_manage = true WHERE role = 'clinic_admin';` create `app.current_can_manage()` as `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public` returning `COALESCE((SELECT m.can_manage FROM public.memberships m WHERE m.clinic_id = app.current_clinic_id() AND m.user_id = app.current_user_id() AND m.status = 'active'), false)`; `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO sw_app;` `DROP POLICY` + `CREATE POLICY` (same names, same tenant predicate as 0003, `USING` and `WITH CHECK` for updates) replacing `app.current_role() = 'clinic_admin'` with `app.current_can_manage()` for the eight policies listed above; trigger function `app.protect_membership_self()` (`BEFORE UPDATE`, raises when `current_user = 'sw_app' AND OLD.user_id = app.current_user_id() AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.can_manage IS DISTINCT FROM OLD.can_manage)`); revoke the new functions from `anon`/`authenticated` inside the same role-existence guard pattern as 0003. Add the Drizzle column. Run `npm run db:bundle`.
- [ ] **Step 4: Run** the test file — Expected: PASS. Then `npm run check` — Expected: green.
- [ ] **Step 5: Commit** `feat(db): manager flag on memberships with RLS and self-change trigger (0009)`.

### Task 2: Permission model and session plumbing

**Files:**
- Modify: `src/lib/authz/permissions.ts`, `src/lib/authz/context.ts`, `src/lib/auth/session-store.ts`, `src/lib/auth/current.ts`, `src/lib/services/demo-sandbox.ts` (`viewAsAllowed`), `src/lib/services/audit.ts:49`, `src/lib/services/staff.ts:15-17`, `src/app/app/layout.tsx:23-24`, `src/app/app/settings/page.tsx:42`
- Test: `tests/unit/permissions.test.ts` (create), `tests/integration/manager-session.test.ts` (create)

**Interfaces:**
- Consumes: `memberships.canManage` (Task 1).
- Produces:
  - `export interface Access { role: MemberRole; canManage: boolean }`
  - `export const MANAGE_PERMISSIONS = ["staff.manage", "audit.read", "demo.reset"] as const`
  - `export function can(subject: MemberRole | Access, permission: Permission): boolean` — management permissions only when `typeof subject !== "string" && subject.canManage`; the role matrix no longer lists them.
  - `AppContext` and `SessionContext` gain `canManage: boolean`; `toAppContext` copies it; `requirePermission`/`authorizeAction` call `can(session, permission)`.

- [ ] **Step 1: Write the failing tests.** `tests/unit/permissions.test.ts`: `can("clinic_admin", "staff.manage") === false`; `can({ role: "staff", canManage: true }, "staff.manage") === true`; `can({ role: "staff", canManage: true }, "patient.read_clinical") === false`; `can({ role: "physician", canManage: false }, "flag.review") === true`; every `MANAGE_PERMISSIONS` entry is false for every bare role. `tests/integration/manager-session.test.ts`: `session reflects can_manage changes immediately` (create a session for a staff user, flip `can_manage` via `withSystem`, `resolveSession` returns the new value); `view-as ends when the actor stops managing` (sandbox, start view-as as a placeholder, clear the human actor's `can_manage`, `resolveSession` returns `null`).
- [ ] **Step 2: Run** both files — Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above. `resolveSession` selects `memberships.canManage` and the view-as actor check requires `can_manage = true` instead of `role = 'clinic_admin'`; `viewAsAllowed` uses `row.isPlaceholder || row.canManage`. Switch every management-permission call site listed in Files to pass the session/context object.
- [ ] **Step 4: Run** the two files, then `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(authz): management permissions come from the manager flag`.

### Task 3: Membership-management rules, seeds and reset links

**Files:**
- Modify: `src/lib/services/staff.ts`, `src/lib/services/demo-seed.ts:264-275`, `src/lib/auth/accounts.ts:111,193,249-270`, `src/app/app/actions.ts` (new action)
- Test: `tests/integration/staff-management.test.ts` (create)

**Interfaces:**
- Consumes: `can(ctx, ...)`, `AppContext.canManage` (Task 2).
- Produces:
  - `export async function setMemberCanManage(ctx: AppContext, input: { userId: string; canManage: boolean }, database?: DatabaseHandle): Promise<void>` — audit action `membership.manage_changed` with `{ from, to }`.
  - `export async function setMemberCanManageAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult>` (fields `userId`, `canManage` = `"true" | "false"`; message "Manager access updated.").
  - Internal `lockClinicMemberships(tx, ctx)` that selects the clinic's memberships `FOR UPDATE` and re-checks the actor is still an active manager (else `ServiceError("Only clinic managers can manage staff.")`); used by `changeMemberRole`, `setMemberStatus`, `setMemberCanManage`.
  - `changeMemberRole` audit metadata adds `clinicalGrant: true` when the new role is `physician` or `clinic_admin` and the old one wasn't.

- [ ] **Step 1: Write the failing tests** in `tests/integration/staff-management.test.ts`: `managers toggle another member's manager flag` (audit row written); `refuses self role and self flag changes` (exact error text from Global Constraints); `keeps a human manager` (the only non-placeholder manager can't be disabled or un-flagged; placeholder managers don't count); `concurrent removals keep one manager` (two managers un-flag each other via `Promise.allSettled`; exactly one succeeds); `invited practice admin is not a manager` (accept an invitation with role `clinic_admin` → `can_manage = false`); `seeded admins are managers` (seed a clinic: `clinic_admin` staff and the sandbox owner have `can_manage = true`, others `false`); `reset links only in sandboxes` (manager in a non-sandbox clinic gets `{ ok: false }` with "Reset links are only available in demo workspaces. Ask the person to use Forgot password."; sandbox manager gets a link); `clinical grants are flagged in the audit log`.
- [ ] **Step 2: Run** the file — Expected: FAIL.
- [ ] **Step 3: Implement.** `requireAdmin` error text becomes "Only clinic managers can manage staff."; replace `assertKeepsAnAdmin` with a guard over the locked rows counting active `can_manage` members whose user `is_placeholder = false`, applied when disabling a manager or clearing a flag; role changes no longer touch manager status. Seeds set `canManage: member.role === "clinic_admin"` for staff and `true` for the owner insert; invitation acceptance inserts `canManage: false` explicitly. `issueResetLinkForMember` requires the actor's `can_manage` and the clinic's `is_sandbox`.
- [ ] **Step 4: Run** the file, then `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(staff): manager flag management, last-manager guard, sandbox-only reset links`.

### Task 4: Staff page, labels, e2e and docs

**Files:**
- Modify: `src/app/app/staff/page.tsx`, `src/components/app/staff/staff-controls.tsx`, `src/lib/labels.ts:32` (`clinic_admin: "Practice admin"`), `src/lib/services/members.ts` (include `canManage` in `listMembers` rows)
- Modify docs: `docs/ARCHITECTURE.md` (§6.3 permission matrix, §14 decision, §15 delta), `docs/SECURITY.md` (manager flag; reset links sandbox-only; self-change trigger), `docs/PRODUCT_SPEC.md` (roles), `docs/ROADMAP.md`, `docs/COLLABORATION.md`
- Test: `tests/e2e/roles.spec.ts` (add test)

**Interfaces:**
- Consumes: `setMemberCanManageAction` (Task 3), `listMembers` rows with `canManage: boolean`.
- Produces: `export function ManageToggle({ userId, canManage, disabled }: { userId: string; canManage: boolean; disabled?: boolean })` in `staff-controls.tsx` — a labelled checkbox/switch "Manages the clinic"; disabled for the signed-in user with the hint "Ask another manager to change your access."

- [ ] **Step 1: Write the failing e2e test** `a manager flag gives front desk staff management without clinical access` in `tests/e2e/roles.spec.ts`: sign in as admin, on Staff turn on "Manages the clinic" for Daniel Okafor (front desk), sign out; sign in as front desk → nav shows "Staff" and "Audit log", `/app/review` redirects to access-denied, the Staff page has no "Reset link" button (shared demo clinic is not a sandbox); finally sign back in as admin and turn the flag off (keeps the shared DB clean for later tests).
- [ ] **Step 2: Run** `npx playwright test tests/e2e/roles.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the toggle and a "Manager" marker per member row; render the reset-link control only when `session.isSandbox`; invite dialog option text "Practice admin — office and reporting (grant manager access after they join)"; label rename. Update the docs listed in Files with the new model and the reset-link restriction.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e` (stop any running `next dev` first and delete `.next/dev` afterwards) — Expected: green.
- [ ] **Step 5: Commit** `feat(staff): "Manages the clinic" toggle; docs for the role split`.

## Next plans (not part of this one)

M2 role codes and join requests (including the physician-visible clinical-grant notice that reads `clinicalGrant` audit rows), M3 start-or-join sign-up with email verification via the dev outbox, M4 Google sign-in — each gets its own plan after M1 merges.
