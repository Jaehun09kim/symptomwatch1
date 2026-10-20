# Onboarding M2 — Join Codes, Join Page, Email Confirmation, Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clinic manager generates a 90-second role code (with a live countdown) choosing "I approve each person" or "Let them in right away"; a colleague enters it on a "Join with a code" page reached from sign-in, confirms their email, and either lands in the clinic or waits for one-click approval.

**Architecture:** New tables in migration `0011_join_codes.sql`. Managers create codes and decide requests on the tenant path (RLS via `app.current_can_manage()`). Applicants have no membership yet, so code lookup, join transactions, email verification and pending-identity sessions live in the existing auth module (already on the `withSystem` allowlist). Codes and tokens are stored only as keyed hashes. Clinical-access grants are written to a member-readable table so physicians see who was let in.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Drizzle, Postgres RLS / PGlite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-clinic-onboarding-design.md` (milestones 2–3, "Owner refinement" incl. 90-second codes, security findings 4, 6, 8). Builds on M1 (`onboarding-m1`: `memberships.can_manage`, `app.current_can_manage()`, `can(subject)`, `lockClinicMemberships`).

## Global Constraints

- New migration file `db/migrations/0011_join_codes.sql`; never edit 0001–0010; `npm run db:bundle`.
- Code format: 8 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, displayed `XXXX-XXXX`; generated with `crypto.randomInt`; input normalized by uppercasing and removing spaces and dashes; stored as `hashToken(normalized, "join_code")`; unique index on the hash with collision retry (max 5).
- Code lifetime **90 seconds** (`expires_at = now() + interval '90 seconds'`), server-enforced. Join transaction lifetime **15 minutes**, single-use, HttpOnly cookie `sw_join`. Email verification link lifetime **30 minutes**, single-use.
- Approval modes exactly `approve` (default) and `instant`. Instant joins never set `can_manage`. Every join creates a `join_requests` row (instant: `status = 'approved'`, `decided_by` NULL).
- One generic message for any unusable code: "That code isn't valid. Codes expire 90 seconds after they're created — ask for a new one." Rate limit `joinCode: { limit: 10, windowMs: 10 * 60_000 }` keyed by IP and, when known, by user.
- Membership is granted only to a user whose `email_verified_at` is set. Revoking a code declines its pending requests; expiry does not.
- No real email: verification messages go to the dev outbox (`kind = 'email_verification'`). Fictional-data rules and the demo banner unchanged. Light app tokens; radii ≤ 8px; AA contrast.
- Countdown: computed from the server's `expiresAt`; screen-reader announcements only at 60, 30, 10 seconds and expiry; no motion under reduced motion beyond the number changing.
- Definition of done per task: `npm run check` green; UI tasks also `npm run test:e2e` green; docs updated in the last task.

## Review Focus

1. A code entered 1 second before expiry, then confirmation finishing 10 minutes later — expect the join to complete (transaction, not code, governs) (Task 3 test `join transaction outlives the code`).
2. The same browser opening a verification link after its join transaction expired, or a link opened twice — expect a clear refusal, no membership (Task 3 tests `expired join transaction refuses` and `verification link is single-use`).
3. An existing member of the clinic entering a code for it (or a disabled member) — expect "You already belong to this clinic" and no role change (Task 3 test `existing members cannot rejoin through a code`).
4. A manager deciding a request while the applicant withdraws, or two managers approving at once — expect exactly one terminal state and one membership (Task 2 test `decisions are single and atomic`).
5. Guessing codes — expect the rate limit to stop the 11th attempt in 10 minutes from one IP regardless of user (Task 3 test `code attempts are rate limited`).

---

### Task 1: Migration 0011 and code primitives

**Files:**
- Create: `db/migrations/0011_join_codes.sql`, `src/lib/onboarding/codes.ts`
- Modify: `src/lib/db/schema.ts` (tables `joinCodes`, `joinRequests`, `joinTransactions`, `emailVerifications`, `clinicalAccessGrants`; `users.emailVerifiedAt`; outbox `kind` adds `email_verification`), `src/lib/auth/tokens.ts` (`hashToken` purpose union adds `"join_code" | "join" | "verify"`)
- Test: `tests/unit/join-codes.test.ts`, `tests/integration/join-codes-rls.test.ts`

**Interfaces:**
- Produces: `generateJoinCode(): { code: string; display: string }` (code = 8 chars normalized; display = `XXXX-XXXX`); `normalizeJoinCode(input: string): string | null` (null unless exactly 8 alphabet chars after normalization); tables:
  - `join_codes(id, clinic_id, role, approval_mode, code_hash UNIQUE, created_by, created_at, expires_at, revoked_at)` — RLS select/insert/update for managers of the clinic; no delete; FK `(clinic_id, created_by)` → memberships.
  - `join_requests(id, clinic_id, user_id, requested_role, join_code_id, status CHECK IN ('pending','approved','declined','withdrawn'), decided_by, decided_role, decided_at, created_at)` — partial unique `(clinic_id, user_id) WHERE status = 'pending'`; FK `(clinic_id, join_code_id)` → join_codes; RLS select/update for managers; no tenant insert/delete.
  - `join_transactions(id, token_hash UNIQUE, join_code_id, clinic_id, role, approval_mode, user_id NULL, created_at, expires_at, consumed_at)` and `email_verifications(id, user_id, token_hash UNIQUE, join_transaction_id NULL, created_at, expires_at, used_at)` — no `sw_app` grants (system path only).
  - `clinical_access_grants(id, clinic_id, user_id, role, granted_by NULL, via CHECK IN ('role_change','join'), created_at)` — RLS select for any active member of the clinic; insert for managers; no update/delete.
  - `users.email_verified_at timestamptz NULL`; outbox kind check recreated to allow `email_verification`. New tables: FORCE RLS, Data-API revokes, 0005-style owner compatibility.

- [ ] **Step 1: Write the failing tests.** Unit: `generates 8-character codes from the unambiguous alphabet` (1,000 codes, regex `^[A-HJ-NP-Z2-9]{8}$`, display matches `^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$`); `normalizes case, spaces and dashes` (`"hv7k 29qf"` and `"HV7K-29QF"` → `"HV7K29QF"`); `rejects ambiguous or wrong-length input` (`"HV7K-29Q0"`, `"HV7K29Q"` → null). Integration: `managers create and read join codes; others cannot` (staff without flag: insert throws / select 0 rows); `codes default to 90 seconds` (`expires_at - created_at = 90s`); `applicants and sw_app cannot touch join transactions or verifications` (select as any tenant member throws); `members read their clinic's clinical access grants only` (other clinic sees 0).
- [ ] **Step 2: Run** `npx vitest run tests/unit/join-codes.test.ts tests/integration/join-codes-rls.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the migration, schema, `codes.ts`, token purposes; `npm run db:bundle`.
- [ ] **Step 4: Run** the two files, then `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(db): join codes, join requests, verifications, clinical access grants (0011)`.

### Task 2: Manager services — create codes, decide requests, record grants

**Files:**
- Create: `src/lib/services/join-codes.ts`
- Modify: `src/lib/services/staff.ts` (`changeMemberRole` also inserts a `clinical_access_grants` row when `clinicalGrant`)
- Test: `tests/integration/join-codes-manager.test.ts`

**Interfaces:**
- Consumes: `generateJoinCode`, tables (Task 1); `lockClinicMemberships` (M1, export it from `staff.ts`).
- Produces:
  - `createJoinCode(ctx, input: { role: MemberRole; approvalMode: "approve" | "instant" }, db?): Promise<{ id: string; display: string; expiresAt: string }>` — audit `join_code.created`.
  - `cancelJoinCode(ctx, codeId: string, db?): Promise<void>` — sets `revoked_at`, declines its pending requests; audit `join_code.revoked`.
  - `listJoinRequests(ctx, db?): Promise<JoinRequestRow[]>` with `JoinRequestRow = { id; userId; displayName; email; emailVerified: boolean; requestedRole: MemberRole; createdAt: string }` (pending only, oldest first).
  - `decideJoinRequest(ctx, input: { requestId: string; decision: "approve" | "decline"; role?: MemberRole }, db?): Promise<void>` — locks clinic memberships, transitions only `pending`, inserts membership (`can_manage = false`) on approve, never overwrites an existing membership, records grant when the role is clinical, audits `join_request.approved|declined`.
  - `listRecentClinicalGrants(ctx, db?): Promise<Array<{ userName: string; role: MemberRole; grantedByName: string | null; via: "role_change" | "join"; createdAt: string }>>` (last 14 days).

- [ ] **Step 1: Write the failing tests:** `managers create a 90-second code and non-managers cannot`; `approving creates a membership without manager access and records a clinical grant`; `declining leaves no membership`; `cancelling a code declines its pending requests`; `decisions are single and atomic` (approve + withdraw via system update, and two approvals, under `Promise.allSettled` → one terminal state, ≤ 1 membership); `role changes that grant clinical access are visible to physicians` (physician reads the grant via `listRecentClinicalGrants`). Seed pending requests in tests with `withSystem` inserts.
- [ ] **Step 2: Run** `npx vitest run tests/integration/join-codes-manager.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** the file, then `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(onboarding): manager services for join codes, requests and clinical grants`.

### Task 3: Applicant flow — join transaction, email verification, pending identity

**Files:**
- Create: `src/lib/auth/joining.ts`
- Modify: `src/lib/auth/session-store.ts` (`createSessionRecord` accepts `clinicId: string | null`; new `resolveIdentitySession(token)`), `src/lib/auth/accounts.ts` (`writeOutbox` kind adds `"email_verification"`), `src/lib/security/rate-limit.ts` (`RATE_LIMITS.joinCode`)
- Test: `tests/integration/joining.test.ts`

**Interfaces:**
- Consumes: Task 1 tables and primitives; Task 2's grant insert helper (`recordClinicalGrant(tx, { clinicId, userId, role, grantedBy, via })`, exported from `join-codes.ts`).
- Produces:
  - `startJoin(rawCode: string, meta: RequestMeta, db?): Promise<{ ok: true; token: string; clinicName: string; role: MemberRole; expiresAt: Date } | { ok: false; error: string }>` — validates code; creates a join transaction (15 min).
  - `peekJoin(token: string, db?): Promise<{ clinicName: string; role: MemberRole } | null>`.
  - `attachJoinAccount(token, input: { mode: "sign_in"; email; password } | { mode: "sign_up"; displayName; email; password }, meta, db?): Promise<JoinStep>` where `JoinStep = { ok: true; next: "verify_email"; email: string } | { ok: true; next: "joined"; session: SessionGrant } | { ok: true; next: "waiting"; session: { token: string; expiresAt: Date } } | { ok: false; error: string; field?: string }` — if the user's email is verified, completes the join immediately; otherwise issues a verification email (outbox) tied to the transaction.
  - `verifyEmailAndJoin(verificationToken: string, meta, db?): Promise<JoinStep>` — marks the email verified, then completes the join (instant → membership + session for the clinic; approve → pending request + identity-only session).
  - `getPendingJoins(sessionToken: string, db?): Promise<Array<{ requestId: string; clinicId: string; clinicName: string; status: "pending" | "approved" | "declined" | "withdrawn" }>>`, `withdrawJoin(sessionToken, requestId, db?)`, `enterApprovedClinic(sessionToken, clinicId, meta, db?): Promise<SessionGrant | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing tests:** `instant code + verified email joins immediately`; `approve code puts the applicant on the waiting list`; `unverified email gets a verification link in the outbox first`; `join transaction outlives the code` (advance past 90 s, complete within 15 min → success); `expired join transaction refuses`; `verification link is single-use`; `existing members cannot rejoin through a code`; `code attempts are rate limited` (11th from one IP refused); `identity-only sessions see no clinic data` (`resolveSession` → null; tenant queries impossible); `approved applicant enters the clinic`.
- [ ] **Step 2: Run** `npx vitest run tests/integration/joining.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above (time is injected via an optional `now` parameter so tests can advance it).
- [ ] **Step 4: Run** the file, then `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(onboarding): join transactions, email verification and pending identities`.

### Task 4: Staff page — generate code with countdown, join requests

**Files:**
- Create: `src/components/app/staff/join-code-panel.tsx`, `src/components/app/staff/countdown.tsx`, `src/components/app/staff/join-requests.tsx`
- Modify: `src/app/app/staff/page.tsx`, `src/app/app/actions.ts` (`createJoinCodeAction`, `cancelJoinCodeAction`, `decideJoinRequestAction`)
- Test: `tests/components/countdown.test.tsx`, `tests/e2e/onboarding.spec.ts` (create; first test)

**Interfaces:**
- Consumes: Task 2 services.
- Produces: `Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void })` — renders a ring + `m:ss`, `aria-live="polite"` region updated only at 60/30/10/0 s.

- [ ] **Step 1: Write the failing tests.** Component (fake timers): `counts down from 1:30 to 0:00 and fires onExpire once`; `announces only at 60, 30, 10 seconds and expiry`. E2E `manager generates a 90-second code and sees it tick`: admin → Staff → "Invite with a code" → choose Physician, keep "I approve each person" → Generate → code matches `^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$`, timer shows `1:2x` after ~3 s; cancel the code.
- [ ] **Step 2: Run** them — Expected: FAIL.
- [ ] **Step 3: Implement** the panel (role select, approval radio default "I approve each person", Generate, large code with copy button and Countdown, expired state with "Generate new code"), the requests list (name, email with ✓ verified, requested role, Approve with role select, Decline).
- [ ] **Step 4: Run** the tests and `npm run check` — Expected: PASS / green.
- [ ] **Step 5: Commit** `feat(staff): generate 90-second join codes with countdown; approve join requests`.

### Task 5: Join pages, sign-in entry, waiting screen, physicians' notice, docs

**Files:**
- Create: `src/app/(auth)/join/page.tsx`, `src/app/(auth)/join/confirm/page.tsx`, `src/app/(auth)/join/check-email/page.tsx`, `src/app/(auth)/join/waiting/page.tsx`, `src/app/(auth)/verify-email/[token]/page.tsx`, `src/components/auth/join-forms.tsx`
- Modify: `src/app/(auth)/sign-in/page.tsx` (link "Have a code from your clinic? Join with a code"), `src/app/(auth)/actions.ts` (join actions setting/clearing the `sw_join` cookie), `src/app/app/page.tsx` (physicians: "New clinical access" notice from `listRecentClinicalGrants`), docs (`ARCHITECTURE.md` §7/§14/§15, `SECURITY.md`, `PRODUCT_SPEC.md`, `ROADMAP.md`, `COLLABORATION.md`, `DEMO_SCRIPT.md`)
- Test: `tests/e2e/onboarding.spec.ts` (add tests)

**Interfaces:**
- Consumes: Task 3 applicant functions; Task 4 panel to generate codes in e2e.

- [ ] **Step 1: Write the failing e2e tests:** `instant code: a new colleague joins after confirming email` (manager generates instant Front desk code; second browser: sign-in page → "Join with a code" → enters code → sees "Harbor View Family Medicine · joining as Front desk" → creates account → "Check your email" → open the dev outbox link → lands in the app as Front desk); `approval code: waiting screen until approved` (Physician code with approval → applicant reaches "Waiting for Harbor View Family Medicine to approve you" → manager approves on Staff → applicant presses "Enter clinic" → Review flags visible; physicians' dashboard shows the new clinical access notice); `expired codes are refused with the generic message` (enter a cancelled code).
- [ ] **Step 2: Run** `npx playwright test tests/e2e/onboarding.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the pages, actions and notice; update docs.
- [ ] **Step 4: Run** `npm run check` and `npm run test:e2e` (stop any running `next dev` first; clear `.next/dev` afterwards) — Expected: green.
- [ ] **Step 5: Commit** `feat(onboarding): join-with-a-code pages, email confirmation, waiting screen; docs`.

## Next plan

M4 Google sign-in: "Continue with Google" on sign-in and the join confirm step (Google's verified email satisfies confirmation), account linking from Settings — after the owner creates the OAuth client.
